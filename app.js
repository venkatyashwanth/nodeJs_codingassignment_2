const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("The server is running on 3000 port...");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const validatePassword = (password) => {
  return password.length > 6;
};

//API -1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
    SELECT 
      * 
    FROM 
      user
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    const createUserQuery = `
        INSERT INTO 
          user(username,password,name,gender)
        VALUES 
          ('${username}',
          '${hashedPassword}',
          '${name}',
          '${gender}');`;
    if (validatePassword(password)) {
      await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API-2
//API -2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT 
    *
    FROM 
    user
    WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      payload = { username: username };
      const jwtToken = jwt.sign(payload, "secretCode");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authentication

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secretCode", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API3  GET FEEDS API
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const userIdQuery = `
    SELECT
      user_id
    FROM
      user
    WHERE
      username = '${username}';
  `;
  const userId = await db.get(userIdQuery);

  const selectFeedQuery = `
    SELECT
      DISTINCT username,
      tweet,
      date_time AS dateTime
    FROM
        (
        follower
        INNER JOIN user ON following_user_id = user.user_id
        ) AS T
        INNER JOIN tweet ON T.user_id = tweet.user_id
    WHERE
        follower.follower_user_id = '${userId.user_id}'
    ORDER BY
        dateTime DESC
    LIMIT 4;
    `;
  const feed = await db.all(selectFeedQuery);
  response.send(feed);
});

module.exports = app;

//API-4
app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const userIdQuery = `
    SELECT
      user_id
    FROM
      user
    WHERE
      username = '${username}';
  `;
  const userId = await db.get(userIdQuery);

  const followingQuery = `
        SELECT
        name 
        FROM 
        user INNER JOIN follower
        ON user.user_id = follower.follower_user_id
        WHERE 
        following_user_id = '${userId.user_id}'
    `;
  const following = await db.all(followingQuery);
  response.send(following);
});
