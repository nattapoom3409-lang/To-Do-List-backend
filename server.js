const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const app = express();

// ✅ Middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// ✅ Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "to-do-list",
});

// ✅ Register
app.post("/register", (req, res) => {
  const checkEmailSql = "SELECT * FROM users WHERE email = ?";
  db.query(checkEmailSql, [req.body.email], (err, result) => {
    if (err) return res.json({ Status: "Error", Message: "Server error" });

    if (result.length > 0) {
      return res.json({ Status: "Fail", Message: "Email already exists" });
    } else {
      const insertSql =
        "INSERT INTO users (firstname, lastname, email, password) VALUES (?)";
      const values = [
        req.body.firstname,
        req.body.lastname,
        req.body.email,
        req.body.password,
      ];

      db.query(insertSql, [values], (err2) => {
        if (err2)
          return res.json({ Status: "Error", Message: err2.sqlMessage });
        return res.json({
          Status: "Success",
          Message: "User registered successfully",
        });
      });
    }
  });
});

// ✅ Verify User (JWT)
const verifyUser = (req, res, next) => {
  const token = req.cookies.token;
  if (!token)
    return res.json({ Message: "You have to login to use this website." });
  jwt.verify(token, "our-jsontoken-secret-key", (err, decoded) => {
    if (err) return res.json({ Message: "Authentication Error." });
    req.userId = decoded.id;
    req.name = decoded.name;
    next();
  });
};

// ✅ Protected route test
app.get("/", verifyUser, (req, res) => {
  return res.json({ Status: "Success", id: req.userId, name: req.name });
});

// ✅ Login
app.post("/login", (req, res) => {
  const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
  db.query(sql, [req.body.email, req.body.password], (err, data) => {
    if (err) return res.json({ Status: "Error", Message: "Server Side Error" });

    if (data.length > 0) {
      const id = data[0].id;
      const name = data[0].firstname;
      const token = jwt.sign({ id, name }, "our-jsontoken-secret-key", {
        expiresIn: "1d",
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      });

      return res.json({
        Status: "Success",
        Message: "Login successful",
        id,
        name,
      });
    } else {
      return res.json({ Status: "Fail", Message: "Invalid email or password" });
    }
  });
});

// ✅ Logout
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ Status: "Success" });
});

// ✅ Get lists by user
app.get("/lists/:userId", (req, res) => {
  const sql = "SELECT * FROM lists WHERE user_id = ?";
  db.query(sql, [req.params.userId], (err, data) => {
    if (err) return res.json({ Status: "Error", Message: err });
    return res.json({ Status: "Success", lists: data });
  });
});

// ✅ Add list
app.post("/lists", (req, res) => {
  const sql = "INSERT INTO lists (user_id, name) VALUES (?, ?)";
  db.query(sql, [req.body.userId, req.body.name], (err, result) => {
    if (err) return res.json({ Status: "Error", Message: err });
    return res.json({ Status: "Success", id: result.insertId });
  });
});

// ✅ Rename list
app.put("/lists/:id", (req, res) => {
  const sql = "UPDATE lists SET name=? WHERE id=?";
  db.query(sql, [req.body.name, req.params.id], (err) => {
    if (err) return res.json({ Status: "Error" });
    return res.json({ Status: "Success" });
  });
});

// ✅ Delete list (และ task ทั้งหมดใน list)
app.delete("/lists/:id", (req, res) => {
  const listId = req.params.id;
  const sqlDeleteTasks = "DELETE FROM tasks WHERE list_id = ?";
  db.query(sqlDeleteTasks, [listId], (err) => {
    if (err) return res.json({ Status: "Error", Message: err });
    const sqlDeleteList = "DELETE FROM lists WHERE id = ?";
    db.query(sqlDeleteList, [listId], (err2) => {
      if (err2) return res.json({ Status: "Error", Message: err2 });
      return res.json({ Status: "Success" });
    });
  });
});

// ✅ Get tasks by list
app.get("/tasks/:listId", (req, res) => {
  const sql = "SELECT * FROM tasks WHERE list_id = ? ORDER BY position ASC";
  db.query(sql, [req.params.listId], (err, data) => {
    if (err) return res.json({ Status: "Error", Message: err });
    return res.json({ Status: "Success", tasks: data });
  });
});

// ✅ Add task
app.post("/tasks", (req, res) => {
  const sql = `
    INSERT INTO tasks (list_id, title, status, position)
    SELECT ?, ?, 'pending', IFNULL(MAX(position), 0) + 1 FROM tasks WHERE list_id = ?
  `;
  db.query(
    sql,
    [req.body.listId, req.body.title, req.body.listId],
    (err, result) => {
      if (err) return res.json({ Status: "Error", Message: err });
      return res.json({ Status: "Success", id: result.insertId });
    }
  );
});

// ✅ Rename task
app.put("/tasks/:id", (req, res) => {
  const sql = "UPDATE tasks SET title=? WHERE id=?";
  db.query(sql, [req.body.title, req.params.id], (err) => {
    if (err) return res.json({ Status: "Error" });
    return res.json({ Status: "Success" });
  });
});

// ✅ Delete task
app.delete("/tasks/:id", (req, res) => {
  const sql = "DELETE FROM tasks WHERE id=?";
  db.query(sql, [req.params.id], (err) => {
    if (err) return res.json({ Status: "Error" });
    return res.json({ Status: "Success" });
  });
});

// ✅ Toggle task status
app.put("/tasks/status/:id", (req, res) => {
  const sql = "UPDATE tasks SET status=? WHERE id=?";
  db.query(sql, [req.body.status, req.params.id], (err) => {
    if (err) return res.json({ Status: "Error" });
    return res.json({ Status: "Success" });
  });
});

// ✅ เปลี่ยนลำดับ (reorder)
app.put("/tasks/reorder", (req, res) => {
  const { listId, tasks } = req.body;
    console.log("📦 Reorder received:", listId, tasks); // ✅ เพิ่มบรรทัดนี้

  if (!Array.isArray(tasks) || !listId)
    return res.json({ Status: "Error", Message: "Invalid data" });

  const queries = tasks.map((task) => {
    return new Promise((resolve, reject) => {
      const sql = "UPDATE tasks SET position = ? WHERE id = ? AND list_id = ?";
      db.query(sql, [task.position, task.id, listId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  Promise.all(queries)
    .then(() => res.json({ Status: "Success" }))
    .catch((err) => res.json({ Status: "Error", Message: err }));
});

// ✅ ตั้งวันหมดอายุ
app.put("/tasks/due/:id", (req, res) => {
  const sql = "UPDATE tasks SET due_date = ? WHERE id = ?";
  db.query(sql, [req.body.due_date, req.params.id], (err) => {
    if (err) return res.json({ Status: "Error", Message: err });
    return res.json({ Status: "Success" });
  });
});

// ✅ เพิ่มหมวดหมู่
app.put("/tasks/category/:id", (req, res) => {
  const sql = "UPDATE tasks SET category = ? WHERE id = ?";
  db.query(sql, [req.body.category, req.params.id], (err) => {
    if (err) return res.json({ Status: "Error", Message: err });
    return res.json({ Status: "Success" });
  });
});

// ✅ ค้นหา / กรอง
app.get("/tasks/search/:listId", (req, res) => {
  const keyword = `%${req.query.q || ""}%`;
  const sql = `
    SELECT * FROM tasks 
    WHERE list_id = ? AND (title LIKE ? OR category LIKE ?)
    ORDER BY position ASC
  `;
  db.query(sql, [req.params.listId, keyword, keyword], (err, data) => {
    if (err) return res.json({ Status: "Error", Message: err });
    return res.json({ Status: "Success", tasks: data });
  });
});

// ✅ Start server
app.listen(8081, () => console.log("✅ Server running on port 8081"));
