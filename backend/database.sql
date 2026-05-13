-- Git笔记数据库初始化脚本
-- 数据库名: gitnotes

-- 创建数据库
CREATE DATABASE IF NOT EXISTS gitnotes DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gitnotes;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '加密密码',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 代码片段表
CREATE TABLE IF NOT EXISTS snippets (
    snippet_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '片段ID',
    user_id INT DEFAULT 1 COMMENT '所属用户ID',
    title VARCHAR(200) NOT NULL COMMENT '片段标题',
    language VARCHAR(30) DEFAULT 'javascript' COMMENT '编程语言',
    code_content TEXT NOT NULL COMMENT '代码内容',
    tags VARCHAR(500) DEFAULT '[]' COMMENT '标签（JSON数组字符串）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_user_id (user_id),
    INDEX idx_language (language),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='代码片段表';

-- 学习日志表
CREATE TABLE IF NOT EXISTS study_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
    user_id INT DEFAULT 1 COMMENT '所属用户ID',
    title VARCHAR(200) NOT NULL COMMENT '日志标题',
    content TEXT COMMENT 'Markdown内容',
    study_hours DECIMAL(3,1) DEFAULT 0 COMMENT '学习时长（小时）',
    log_date DATE DEFAULT CURRENT_DATE COMMENT '日期',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_user_id (user_id),
    INDEX idx_log_date (log_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学习日志表';

-- 插入测试数据
INSERT INTO users (username, password) VALUES 
('admin', '$2b$10$YourHashedPasswordHere');

INSERT INTO snippets (title, language, code_content, tags) VALUES
('快速排序算法', 'javascript', 'function quickSort(arr) {\n  if (arr.length <= 1) return arr;\n  const pivot = arr[0];\n  const left = arr.slice(1).filter(x => x < pivot);\n  const right = arr.slice(1).filter(x => x >= pivot);\n  return [...quickSort(left), pivot, ...quickSort(right)];\n}', '["算法","排序","递归"]'),
('Python文件遍历', 'python', 'import os\n\ndef traverse_directory(path):\n    for root, dirs, files in os.walk(path):\n        for file in files:\n            print(os.path.join(root, file))', '["文件操作","Python","递归"]'),
('React useState Hook', 'javascript', 'import { useState } from "react";\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <button onClick={() => setCount(count + 1)}>\n      Count: {count}\n    </button>\n  );\n}', '["React","Hook","前端"]');

INSERT INTO study_logs (title, content, study_hours, log_date) VALUES
('学习快速排序', '今天学习了快速排序算法，理解了分治思想。时间复杂度O(nlogn)。', 2.5, '2026-05-07'),
('React Hooks深入', '深入理解了useState和useEffect的工作原理。', 3.0, '2026-05-08');
