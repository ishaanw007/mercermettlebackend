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
    console.log(req.body);
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, req.body.jobId + "-" + req.body.email + ".webm");
  },
});
const storageResume = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "resumes/");
  },
  filename: (req, file, cb) => {
    cb(null, req.body.jobId + "-" + req.body.email + ".pdf");
  },
});
const upload = multer({ storage: storage });
const uploadResume = multer({ storage: storageResume });

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

app.post("/upload-resume", uploadResume.single("resume"), (req, res) => {
  const form = new FormData();

  const {
    firstName,
    lastName,
    email,
    phone,
    noticeperiod,
    company,
    currentctc,
    expectedctc,
    jobId,
  } = req.body;

  const text = `${firstName}-${lastName}-${email}-${phone}-${jobId}-${currentctc}-${expectedctc}-${noticeperiod}-${company}`;
  console.log(text);
  const base64Encoded = Buffer.from(text).toString("base64");
  console.log(base64Encoded);

  // Append the uploaded resume to the form with the key as "file:<filename>"
  form.append("file", fs.createReadStream(req.file.path));

  const forwardRequestOptions = {
    method: "POST",
    host: "ec2-3-70-52-108.eu-central-1.compute.amazonaws.com",
    port: 8080,
    path: `/v1/applications/apply?encodedDetails=${base64Encoded}`,
    headers: form.getHeaders(),
  };

  const forwardRequest = http.request(
    forwardRequestOptions,
    (forwardResponse) => {
      let responseData = "";
      forwardResponse.on("data", (chunk) => {
        responseData += chunk;
      });

      forwardResponse.on("end", () => {
        console.log("Server Response:", responseData);

        let parsedResponse;
        try {
          parsedResponse = JSON.parse(responseData);
        } catch (error) {
          parsedResponse = { message: responseData };
        }

        // Delete the file from the 'resumes' folder
        fs.unlink(path.join(__dirname, "resumes", req.file.filename), (err) => {
          if (err) {
            console.error(
              `Error while deleting file ${req.file.filename}: `,
              err
            );
          } else {
            console.log(`Deleted file ${req.file.filename} successfully.`);
          }

          // Respond back to the client
          res.json({
            message: "Resume uploaded and forwarded successfully!",
            filePath: `resumes/${req.file.filename}`,
            forwardedResponse: parsedResponse,
          });
        });
      });
    }
  );

  form.pipe(forwardRequest);
});

app.post("/upload", upload.single("video"), (req, res) => {
  const form = new FormData();
  console.log(req.body.jobId);
  console.log(req.body.email);
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
          console.log("Server Response:", parsedResponse);
          console.log(req.file.filename);
        } catch (error) {
          parsedResponse = { message: responseData };
        }
        fs.unlink(path.join(__dirname, "uploads", req.file.filename), (err) => {
          if (err) {
            console.error(
              `Error while deleting file ${req.file.filename}: `,
              err
            );
          } else {
            console.log(`Deleted file ${req.file.filename} successfully.`);
          }
          res.json({
            message: "Video uploaded and forwarded successfully!",
            filePath: `uploads/${req.file.filename}`,
            forwardedResponse: parsedResponse,
          });
        });
      });
    }
  );

  form.pipe(forwardRequest);
});
app.get("/api/appliedcandidates", (req, res) => {
  const selectedJobId = req.query.jobId;
  console.log(selectedJobId);

  const options = {
    hostname: "ec2-3-70-52-108.eu-central-1.compute.amazonaws.com",
    port: 8080,
    path: `/v1/applications/candidates?jobId=${selectedJobId}`,
    method: "GET",
  };

  const apiRequest = http.request(options, (apiResponse) => {
    let data = "";

    // A chunk of data has been received.
    apiResponse.on("data", (chunk) => {
      data += chunk;
    });

    // The whole response has been received.
    apiResponse.on("end", () => {
      console.log(data);

      // Before sending a response, you can add a check to see if the received data is actually JSON.
      try {
        res.json(JSON.parse(data));
      } catch (error) {
        console.error("Failed to parse response:", error);
        res.status(500).json({ error: "Failed to parse server response" });
      }
    });
  });

  // Handling errors on the request
  apiRequest.on("error", (error) => {
    console.error(`Error fetching candidates: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch data from the server" });
  });

  apiRequest.end();
});

app.get("/api/viewresume", (req, res) => {
  const selectedJobId = req.query.jobId; // Replace with your jobId or get it dynamically.
  const email = req.query.emailid; // Replace with your jobId or get it dynamically.
  console.log(selectedJobId);
  console.log(email);
  const options = {
    hostname: "ec2-3-70-52-108.eu-central-1.compute.amazonaws.com",
    port: 8080,
    path: `/v1/apis/pre-signed-url?fileName=${selectedJobId}-${email}.pdf`,
    method: "GET",
  };

  const apiRequest = http.request(options, (apiResponse) => {
    let data = "";

    // A chunk of data has been received.
    apiResponse.on("data", (chunk) => {
      data += chunk;
    });

    // The whole response has been received.
    apiResponse.on("end", () => {
      console.log(data);
      res.json(data);
    });
  });
  apiRequest.on("error", (error) => {
    console.error(`Error fetching candidates: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch data" });
  });

  apiRequest.end();
});

app.get("/api/viewvideo", (req, res) => {
  const selectedJobId = req.query.jobId; // Replace with your jobId or get it dynamically.
  const email = req.query.emailid; // Replace with your jobId or get it dynamically.
  console.log(selectedJobId);
  console.log(email);
  const options = {
    hostname: "ec2-3-70-52-108.eu-central-1.compute.amazonaws.com",
    port: 8080,
    path: `/v1/apis/pre-signed-url?fileName=${selectedJobId}-${email}.webm`,
    method: "GET",
  };

  const apiRequest = http.request(options, (apiResponse) => {
    let data = "";

    // A chunk of data has been received.
    apiResponse.on("data", (chunk) => {
      data += chunk;
    });

    // The whole response has been received.
    apiResponse.on("end", () => {
      console.log(data);
      res.json(data);
    });
  });
  apiRequest.on("error", (error) => {
    console.error(`Error fetching candidates: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch data" });
  });

  apiRequest.end();
});
// });
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
