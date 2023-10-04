const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const http = require("http");
const fs = require("fs");
const FormData = require("form-data");
const request = require("request");

const app = express();
const PORT = 3000;
const bodyParser = require("body-parser");

app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(bodyParser.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + ".webm");
  },
});

const upload = multer({ storage: storage });

app.post("/submit-code", (req, res) => {
  console.log("hello");
  console.log(req.body);
  const options = {
    url: "https://ce.judge0.com/submissions?base64_encoded=true&wait=true",
    method: "POST",
    headers: {
      authority: "ce.judge0.com",
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json",
      dnt: "1",
      origin: "https://ide.judge0.com",
      referer: "https://ide.judge0.com/",
      "sec-ch-ua":
        '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "macOS",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    },
    json: req.body,
  };

  request(options, (error, response, body) => {
    if (!error && response.statusCode == 200) {
      res.send(response);
    } else {
      res.status(500).send({ error: "Failed to fetch from judge0" });
    }
  });
});

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

// app.post("/upload", upload.single("video"), (req, res) => {
//   res.send("Upload Sucess");
//   const form = new FormData();
//   form.append("file", fs.createReadStream(req.file.path));

//   const forwardRequest = http.request(
//     {
//       method: "POST",
//       host: "ec2-3-70-52-108.eu-central-1.compute.amazonaws.com",
//       port: 8080,
//       path: "/v1/apis/upload",
//       headers: form.getHeaders(),
//     },
//     (forwardResponse) => {
//       let responseData = "";
//       forwardResponse.on("data", (chunk) => {
//         responseData += chunk;
//       });

//       forwardResponse.on("end", () => {
//         let parsedResponse;
//         try {
//           parsedResponse = JSON.parse(responseData);
//         } catch (error) {
//           parsedResponse = { message: responseData };
//         }

//         res.json({
//           message: "Video uploaded and forwarded successfully!",
//           filePath: `uploads/${req.file.filename}`,
//           forwardedResponse: parsedResponse,
//         });
//       });
//     }
//   );

//   form.pipe(forwardRequest);
// });

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
