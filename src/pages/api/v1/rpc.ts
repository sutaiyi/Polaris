import fs from "fs";
import { NextApiHandler } from "next";

import { decrypt } from "@/config/myCrypto";

const Hello: NextApiHandler = async (req, res) => {
  const value = decrypt(req.headers['ser-ms-request-id'])
  console.log(value)
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  // res.write(JSON.stringify([{ name: "1" }, { name: "2" }]));

  fs.appendFile('text.txt', value + ",", (err) => {
    if (err) {
      console.error('error:', err);
    } else {
      console.log('success');
    }
  });
  res.end();
};

export default Hello;