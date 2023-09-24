const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const http = require("http");
const fs = require("fs");
const FormData = require("form-data");

const app = express();
const PORT = 3000;

app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + ".webm");
  },
});

const upload = multer({ storage: storage });

app.post("/upload", upload.single("video"), (req, res) => {
  const form = new FormData();
  form.append("file", fs.createReadStream(req.file.path));

  const forwardRequest = http.request(
    {
      method: "POST",
      host: "ec2-3-70-52-108.eu-central-1.compute.amazonaws.com",
      port: 8080,
      path: "/v1/apis/upload",
      headers: form.getHeaders(),
    },
    (forwardResponse) => {
      let responseData = "";
      forwardResponse.on("data", (chunk) => {
        responseData += chunk;
      });

      forwardResponse.on("end", () => {
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(responseData);
        } catch (error) {
          parsedResponse = { message: responseData };
        }

        res.json({
          message: "Video uploaded and forwarded successfully!",
          filePath: `uploads/${req.file.filename}`,
          forwardedResponse: parsedResponse,
        });
      });
    }
  );

  form.pipe(forwardRequest);
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
