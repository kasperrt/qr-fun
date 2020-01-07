let express = require("express"),
  exphbs = require("express-handlebars"),
  Busboy = require("busboy"),
  Jimp = require("jimp"),
  bodyParser = require("body-parser"),
  qrcodeReader = require("jsqr"),
  qrcodeCreator = require("qrcode"),
  aes256 = require("aes256"),
  //mongo = require("mongodb").MongoClient;

//const mongoUrl = "mongodb://localhost:27017";
//const dbName = "rekoring";
//let db;
let app = express();
let key = "dette er ikke en sikker nøkkel";
let orderObject = {
  name: "Navn navnesen",
  address: "Gateadressen 1G, 0011 Oslo",
  telephone: "97740427",
  orders: [
    {
      name: "Gulrot",
      quantity: 11,
      totalPrice: 120,
      measuredIn: "kg",
      priceType: "total"
    }
  ]
};

/*mongo.connect(
  mongoUrl,
  (error, client) => {
    if (error) {
      console.log(error);
      process.exit(1);
    }

    db = client.db(dbName);
  }
);*/

app.engine(
  "handlebars",
  exphbs({
    helpers: {
      json: obj => {
        return JSON.stringify(obj, null, 2);
      }
    }
  })
);
app.set("view engine", "handlebars");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("static"));

app.get("/reader", (req, res) => {
  res.render("reader");
});

app.get("/mobile", (req, res) => {
  res.render("mobile_reader");
});

app.get("/writer", (req, res) => {
  let encryptedString = aes256.encrypt(key, JSON.stringify(orderObject));
  qrcodeCreator.toDataURL(encryptedString, (error, dataUrl) => {
    res.render("writer", {
      qrImage: dataUrl
    });
  });
});

app.post("/string-send", async (req, res) => {
  const encrypted = req.body.qrData;
  res.render("decrypt", {
    encrypted: encrypted,
    decrypted: JSON.parse(aes256.decrypt(key, encrypted))
  });
});

app.post("/ajax-send", async (req, res) => {
  const encrypted = req.body.qrData;
  res.setHeader("Content-Type", "application/json");
  console.log(req.body);
  if (encrypted == undefined) {
    res.send(JSON.stringify({ success: false }));
    return;
  }
  try {
    let response = aes256.decrypt(key, encrypted);
    if (response) {
      res.send(JSON.stringify({ success: true }));
      return;
    }
    res.send(JSON.stringify({ success: false }));
    return;
  } catch (e) {
    res.send(JSON.stringify({ success: false }));
    return;
  }
});

app.post("/qr-upload", async (req, res) => {
  let busboy = new Busboy({ headers: req.headers });
  busboy.on("file", (fieldname, file) => {
    let buffer = [];

    file.on("data", _buffer => {
      buffer.push(_buffer);
    });

    file.on("end", () => {
      readQrCode(Buffer.concat(buffer), res);
    });
  });
  req.pipe(busboy);
});

readQrCode = (buffer, res) => {
  Jimp.read(buffer, (error, image) => {
    if (error) {
      res.send("feil med bildet");
    }

    let code = qrcodeReader(
      image.bitmap.data,
      image.bitmap.width,
      image.bitmap.height
    );

    if (code) {
      res.render("decrypt", {
        encrypted: code.data,
        decrypted: JSON.parse(aes256.decrypt(key, code.data))
      });
    } else {
      res.send("klarte ikke finne noe QR");
    }
    return;
  });
};

app.listen(3000);
