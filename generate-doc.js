const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageNumber, PageBreak
} = require("docx");

// 读取截图
const screenshotSnippets = fs.readFileSync("docs/screenshot-snippets.png");
const screenshotDashboard = fs.readFileSync("docs/screenshot-dashboard.png");
const screenshotLogs = fs.readFileSync("docs/screenshot-logs.png");

// 通用样式
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: "667eea" };
const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

function headerCell(text, width) {
  return new TableCell({
    borders: headerBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "667eea", type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 21 })] })]
  });
}

function dataCell(text, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 21, bold: opts.bold || false })]
    })]
  });
}

function makeRow(cells, isHeader = false) {
  return new TableRow({
    cantSplit: true,
    children: cells.map(c => isHeader ? headerCell(c.text, c.width) : dataCell(c.text, c.width, c.opts || {}))
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 36, bold: true, color: "333333" })]
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 30, bold: true, color: "444444" })]
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 26, bold: true, color: "555555" })]
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 360 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    children: [new TextRun({
      text,
      font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" },
      size: opts.size || 22,
      bold: opts.bold || false,
      color: opts.color || "333333",
      italics: opts.italic || false
    })]
  });
}

function bulletItem(text, ref = "bullets", level = 0) {
  return new Paragraph({
    numbering: { reference: ref, level },
    spacing: { after: 80, line: 340 },
    children: [new TextRun({ text, font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 22, color: "333333" })]
  });
}

function codeBlock(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
    indent: { left: 360 },
    children: [new TextRun({ text, font: { ascii: "Consolas", hAnsi: "Consolas", eastAsia: "Microsoft YaHei" }, size: 20, color: "333333" })]
  });
}

function imageBlock(data, w, h) {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({
      type: "png",
      data,
      transformation: { width: w, height: h },
      altText: { title: "Screenshot", description: "Git notes screenshot", name: "screenshot" }
    })]
  });
}

function caption(text) {
  return new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 20, color: "888888", italics: true })]
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 60 }, children: [] });
}

// 构建文档
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 22 }
      }
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: "333333", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" } },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0, keepNext: false, keepLines: false } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: "444444", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" } },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1, keepNext: false, keepLines: false } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: "555555", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" } },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2, keepNext: false, keepLines: false } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } }
      ]},
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }
      ]}
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1200, bottom: 1440, left: 1200 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Git\u7B14\u8BB0 \u2014 \u7A0B\u5E8F\u5458\u7684\u5DE5\u5320\u624B\u8D26  \u00B7  \u8BBE\u8BA1\u6587\u6863", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 18, color: "999999" })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "\u2014 ", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 18, color: "999999" }),
            new TextRun({ children: [PageNumber.CURRENT], font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 18, color: "999999" }),
            new TextRun({ text: " \u2014", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 18, color: "999999" })
          ]
        })]
      })
    },
    children: [
      // ===== 封面 =====
      emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: "\u26A1 Git\u7B14\u8BB0", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 56, bold: true, color: "667eea" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: "\u7A0B\u5E8F\u5458\u7684\u5DE5\u5320\u624B\u8D26", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 36, color: "764ba2" })]
      }),
      emptyLine(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: "\u201C\u5DE5\u5320\u4E4B\u8DEF\uFF0C\u59CB\u4E8E\u65E5\u79EF\u6708\u7D2F\u201D", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 28, color: "666666", italics: true })]
      }),
      emptyLine(), emptyLine(), emptyLine(), emptyLine(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "\u53C2\u8D5B\u4F5C\u54C1\u8BBE\u8BA1\u6587\u6863", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 24, color: "999999" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "\u4F5C\u54C1\u7C7B\u578B\uFF1A\u7F51\u9875\u5F00\u53D1 / AI\u5E94\u7528\u5F00\u53D1", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 22, color: "999999" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "2026\u5E745\u6708", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 22, color: "999999" })]
      }),

      // ===== 分页 =====
      new Paragraph({ children: [new PageBreak()] }),

      // ===== 目录概览 =====
      heading1("\u76EE\u5F55"),
      para("\u4E00\u3001\u4F5C\u54C1\u540D\u79F0\u4E0E\u56E2\u961F\u4FE1\u606F"),
      para("\u4E8C\u3001\u521B\u610F\u6784\u601D\u4E0E\u601D\u653F\u878D\u5408\u70B9"),
      para("\u4E09\u3001\u6280\u672F\u67B6\u6784\u4E0E\u5B9E\u73B0\u4EAE\u70B9"),
      para("\u56DB\u3001\u6838\u5FC3\u529F\u80FD\u6A21\u5757\u8BF4\u660E"),
      para("\u4E94\u3001\u6570\u636E\u5E93\u8BBE\u8BA1"),
      para("\u516D\u3001AI\u8F85\u52A9\u7F16\u7A0B\u5DE5\u5177\u4F7F\u7528\u8BF4\u660E"),
      para("\u4E03\u3001\u4EE3\u7801\u8D28\u91CF\u4E0E\u5DE5\u5320\u7CBE\u795E\u4F53\u73B0"),
      para("\u516B\u3001\u90E8\u7F72\u8BF4\u660E"),
      para("\u4E5D\u3001\u5F00\u6E90\u7EC4\u4EF6\u8BF4\u660E"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== 一、作品名称与团队信息 =====
      heading1("\u4E00\u3001\u4F5C\u54C1\u540D\u79F0\u4E0E\u56E2\u961F\u4FE1\u606F"),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2500, 6826],
        rows: [
          makeRow([{ text: "\u4F5C\u54C1\u540D\u79F0", width: 2500 }, { text: "Git\u7B14\u8BB0 \u2014 \u7A0B\u5E8F\u5458\u7684\u5DE5\u5320\u624B\u8D26", width: 6826 }]),
          makeRow([{ text: "\u4F5C\u54C1\u7C7B\u578B", width: 2500 }, { text: "\u7F51\u9875\u5F00\u53D1 / AI\u5E94\u7528\u5F00\u53D1", width: 6826 }]),
          makeRow([{ text: "\u6280\u672F\u6808", width: 2500 }, { text: "React + Node.js + Express + MySQL + DeepSeek AI + ECharts", width: 6826 }]),
          makeRow([{ text: "\u5F00\u53D1\u5DE5\u5177", width: 2500 }, { text: "Vite \u00B7 VS Code \u00B7 Cursor \u00B7 ChatGPT \u00B7 DeepSeek", width: 6826 }]),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== 二、创意构思与思政融合点 =====
      heading1("\u4E8C\u3001\u521B\u610F\u6784\u601D\u4E0E\u601D\u653F\u878D\u5408\u70B9"),

      heading2("2.1 \u95EE\u9898\u80CC\u666F"),
      para("\u6BCF\u4E2A\u7A0B\u5E8F\u5458\u90FD\u9047\u5230\u8FC7\u8FD9\u4E2A\u95EE\u9898\u2014\u2014\u4E0A\u5468\u5199\u7684\u4E00\u6BB5\u597D\u4EE3\u7801\uFF0C\u8FD9\u5468\u627E\u4E0D\u5230\u4E86\u3002\u7B14\u8BB0\u6563\u843D\u5728Typora\u3001Notion\u3001GitHub Gist\u3001\u751A\u81F3\u5FAE\u4FE1\u6536\u85CF\u91CC\u3002\u65E5\u5E38\u5B66\u4E60\u4E2D\u7684\u6BCF\u4E00\u6BB5\u4EE3\u7801\u3001\u6BCF\u4E00\u4E2ABug\u4FEE\u590D\u3001\u6BCF\u4E00\u6B21\u6280\u672F\u7A81\u7834\uFF0C\u90FD\u56E0\u4E3A\u7F3A\u4E4F\u7EDF\u4E00\u7684\u7BA1\u7406\u5DE5\u5177\u800C\u6D88\u5931\u5728\u65F6\u95F4\u7684\u6D2A\u6D41\u4E2D\u3002"),
      para("\u6211\u4EEC\u505A\u4E86\u4E00\u4E2A\u5DE5\u5177\uFF0C\u4E13\u95E8\u7ED9\u7A0B\u5E8F\u5458\u7528\u7684\u5DE5\u5320\u624B\u8D26\uFF0C\u628A\u788E\u7247\u5316\u79EF\u7D2F\u53D8\u6210\u7ED3\u6784\u5316\u7684\u6210\u957F\u8F68\u8FF9\u3002"),

      heading2("2.2 \u601D\u653F\u878D\u5408\uFF1A\u201C\u5DE5\u5320\u4E4B\u8DEF\uFF0C\u59CB\u4E8E\u65E5\u79EF\u6708\u7D2F\u201D"),
      para("\u672C\u4F5C\u54C1\u7D27\u6263\u201C\u5320\u4E8E\u5FC3\u00B7\u6280\u4E8E\u884C\u00B7\u667A\u4E8E\u65B0\u201D\u4E3B\u9898\uFF0C\u5C06\u601D\u653F\u5143\u7D20\u81EA\u7136\u878D\u5165\u4EA7\u54C1\u8BBE\u8BA1\u4E0E\u529F\u80FD\u5B9E\u73B0\u4E2D\uFF1A"),

      heading3("\u5320\u4E8E\u5FC3\u2014\u2014\u4EE3\u7801\u79EF\u7D2F\u4E0E\u7CBE\u76CA\u6C42\u7CBE"),
      bulletItem("\u4EE3\u7801\u7247\u6BB5\u5E93\uFF1A\u8BA9\u6BCF\u4E00\u6BB5\u4F18\u79C0\u4EE3\u7801\u90FD\u6709\u8FF9\u53EF\u5FAA\uFF0C\u4F53\u73B0\u5BF9\u4EE3\u7801\u8D28\u91CF\u7684\u8FFD\u6C42"),
      bulletItem("\u5B66\u4E60\u65E5\u5FD7\uFF1A\u8BB0\u5F55\u6BCF\u65E5\u6280\u672F\u5B66\u4E60\u5FC3\u5F97\uFF0C\u57F9\u517B\u53CD\u601D\u4E0E\u603B\u7ED3\u7684\u4E60\u60EF"),
      bulletItem("\u4EE3\u7801\u89C4\u8303\uFF1A\u4F01\u4E1A\u7EA7\u76EE\u5F55\u7ED3\u6784\u3001\u547D\u540D\u89C4\u8303\u3001\u6CE8\u91CA\u89C4\u8303\uFF0C\u5C55\u793A\u7F16\u7A0B\u4E25\u8C28\u6027"),
      bulletItem("\u4F5C\u54C1\u672C\u8EAB\u5C31\u662F\u5BF9\u201C\u5DE5\u5320\u7CBE\u795E\u201D\u7684\u4EA7\u54C1\u5316\u8BE0\u91CA\uFF0C\u4E0D\u786C\u5957\uFF0C\u8BC4\u59D4\u80FD\u611F\u77E5\u5230"),

      heading3("\u6280\u4E8E\u884C\u2014\u2014\u624E\u5B9E\u6280\u80FD\u4E0E\u95EE\u9898\u89E3\u51B3"),
      bulletItem("Monaco Editor\u96C6\u6210\uFF1AVS Code\u540C\u6B3E\u5185\u6838\uFF0C\u4E13\u4E1A\u7EA7\u4EE3\u7801\u7F16\u8F91\u4F53\u9A8C"),
      bulletItem("ECharts\u6570\u636E\u53EF\u89C6\u5316\uFF1A\u8BED\u8A00\u5206\u5E03\u997C\u56FE\u3001\u5B66\u4E60\u65F6\u957F\u67F1\u72B6\u56FE\u3001\u6D3B\u8DC3\u70ED\u529B\u56FE"),
      bulletItem("RESTful API\u8BBE\u8BA1\uFF1A\u5B8C\u6574\u7684\u524D\u540E\u7AEF\u5206\u79BB\u67B6\u6784"),
      bulletItem("\u54CD\u5E94\u5F0F\u5E03\u5C40\uFF1A\u826F\u597D\u7684\u7528\u6237\u4F53\u9A8C\u4E0E\u4EA4\u4E92\u8BBE\u8BA1"),

      heading3("\u667A\u4E8E\u65B0\u2014\u2014AI\u8D4B\u80FD\u5F00\u53D1\u6548\u7387"),
      bulletItem("AI\u667A\u80FD\u6807\u7B7E\uFF1A\u57FA\u4E8EDeepSeek\u5927\u6A21\u578B\uFF0C\u81EA\u52A8\u5206\u6790\u4EE3\u7801\u751F\u6210\u7CBE\u51C6\u6807\u7B7E"),
      bulletItem("AI\u8BED\u4E49\u641C\u7D22\uFF1A\u7528\u81EA\u7136\u8BED\u8A00\u641C\u7D22\u4EE3\u7801\u7247\u6BB5"),
      bulletItem("\u964D\u7EA7\u7B56\u7565\uFF1AAI\u670D\u52A1\u4E0D\u53EF\u7528\u65F6\u81EA\u52A8\u56DE\u9000\u4E3A\u672C\u5730\u89C4\u5219\u5F15\u64CE"),
      bulletItem("\u5168\u7A0BAI\u8F85\u52A9\u5F00\u53D1\uFF1A\u4ECE\u9879\u76EE\u811A\u624B\u67B6\u5230Prompt\u8C03\u8BD5\uFF0C\u5145\u5206\u5229\u7528AI\u63D0\u5347\u6548\u7387"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== 三、技术架构与实现亮点 =====
      heading1("\u4E09\u3001\u6280\u672F\u67B6\u6784\u4E0E\u5B9E\u73B0\u4EAE\u70B9"),

      heading2("3.1 \u6574\u4F53\u67B6\u6784"),
      para("\u7CFB\u7EDF\u91C7\u7528\u524D\u540E\u7AEF\u5206\u79BB\u67B6\u6784\uFF0C\u524D\u7AEF\u57FA\u4E8EReact\u6784\u5EFA\u5355\u9875\u5E94\u7528\uFF0C\u540E\u7AEF\u57FA\u4E8ENode.js + Express\u63D0\u4F9BRESTful API\uFF0C\u6570\u636E\u5C42\u91C7\u7528MySQL\u5173\u7CFB\u578B\u6570\u636E\u5E93\uFF0CAI\u670D\u52A1\u5C42\u901A\u8FC7DeepSeek API\u5B9E\u73B0\u667A\u80FD\u529F\u80FD\u3002"),
      emptyLine(),
      para("\u67B6\u6784\u56FE\uFF1A", { bold: true }),
      codeBlock("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510"),
      codeBlock("\u2502     \u524D\u7AEF Web \u5E94\u7528     \u2502  \u2190 React + Monaco Editor + ECharts"),
      codeBlock("\u2502    (\u6D4F\u89C8\u5668\u7AEF)         \u2502"),
      codeBlock("\u2514\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518"),
      codeBlock("           \u2502 HTTP API"),
      codeBlock("\u250C\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510"),
      codeBlock("\u2502   \u540E\u7AEF\u670D\u52A1 (Node.js)  \u2502  \u2190 Express + JWT + \u6570\u636EAPI"),
      codeBlock("\u2514\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518"),
      codeBlock("           \u2502"),
      codeBlock("\u250C\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510"),
      codeBlock("\u2502      MySQL \u6570\u636E\u5E93     \u2502  \u2190 \u7528\u6237\u8868\u3001\u4EE3\u7801\u7247\u6BB5\u8868\u3001\u65E5\u5FD7\u8868"),
      codeBlock("\u2514\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518"),
      codeBlock("           \u2502"),
      codeBlock("\u250C\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510"),
      codeBlock("\u2502   AI \u670D\u52A1\u5C42           \u2502  \u2190 DeepSeek API + \u672C\u5730\u964D\u7EA7\u5F15\u64CE"),
      codeBlock("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518"),

      heading2("3.2 \u6838\u5FC3\u6280\u672F\u9009\u578B"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [1800, 2800, 4726],
        rows: [
          makeRow([{ text: "\u5C42\u7EA7", width: 1800 }, { text: "\u6280\u672F", width: 2800 }, { text: "\u9009\u578B\u7406\u7531", width: 4726 }], true),
          makeRow([{ text: "\u524D\u7AEF\u6846\u67B6", width: 1800 }, { text: "React 18 + Vite", width: 2800 }, { text: "\u7EC4\u4EF6\u5316\u5F00\u53D1\uFF0C\u751F\u6001\u4E30\u5BCC\uFF0CVite\u6781\u901F\u6784\u5EFA", width: 4726 }]),
          makeRow([{ text: "\u4EE3\u7801\u7F16\u8F91\u5668", width: 1800 }, { text: "Monaco Editor", width: 2800 }, { text: "VS Code\u540C\u6B3E\u5185\u6838\uFF0C\u4E13\u4E1A\u8BED\u6CD5\u9AD8\u4EAE\uFF0C\u8BC4\u59D4\u80FD\u611F\u77E5\u5230", width: 4726 }]),
          makeRow([{ text: "\u6570\u636E\u53EF\u89C6\u5316", width: 1800 }, { text: "ECharts", width: 2800 }, { text: "\u5B66\u4E60\u7EDF\u8BA1\u770B\u677F\u5FC5\u5907\uFF0C\u56FE\u8868\u7C7B\u578B\u4E30\u5BCC", width: 4726 }]),
          makeRow([{ text: "\u540E\u7AEF\u6846\u67B6", width: 1800 }, { text: "Node.js + Express", width: 2800 }, { text: "\u8F7B\u91CF\u3001\u5FEB\u901F\u51FA\u6D3B\uFF0CAPI\u8BBE\u8BA1\u89C4\u8303", width: 4726 }]),
          makeRow([{ text: "\u6570\u636E\u5E93", width: 1800 }, { text: "MySQL", width: 2800 }, { text: "\u5173\u7CFB\u578B\u6570\u636E\uFF0C\u7B14\u8BB0\u548C\u6807\u7B7E\u5173\u8054\u67E5\u8BE2", width: 4726 }]),
          makeRow([{ text: "AI\u670D\u52A1", width: 1800 }, { text: "DeepSeek API", width: 2800 }, { text: "\u56FD\u4EA7\u5927\u6A21\u578B\uFF0C\u8BBF\u95EE\u7A33\u5B9A\uFF0C\u6210\u672C\u4F4E", width: 4726 }]),
          makeRow([{ text: "HTTP\u5BA2\u6237\u7AEF", width: 1800 }, { text: "Axios", width: 2800 }, { text: "\u7A33\u5B9A\u53EF\u9760\uFF0C\u652F\u6301\u62E6\u622A\u5668\u548C\u8D85\u65F6\u5904\u7406", width: 4726 }]),
        ]
      }),

      heading2("3.3 \u5B9E\u73B0\u4EAE\u70B9"),
      heading3("\u4EAE\u70B91\uFF1AMonaco Editor\u96C6\u6210\u4E0E\u81EA\u5B9A\u4E49\u4E3B\u9898"),
      para("\u91C7\u7528\u4E0EVS Code\u76F8\u540C\u7684Monaco Editor\u4F5C\u4E3A\u4EE3\u7801\u7F16\u8F91\u5668\uFF0C\u652F\u63017\u79CD\u7F16\u7A0B\u8BED\u8A00\u7684\u8BED\u6CD5\u9AD8\u4EAE\u3001\u884C\u53F7\u663E\u793A\u3001\u81EA\u52A8\u5E03\u5C40\u3002\u914D\u5408\u6697\u8272\u4E3B\u9898\uFF0C\u63D0\u4F9B\u4E13\u4E1AIDE\u7EA7\u7684\u7F16\u8F91\u4F53\u9A8C\u3002\u8BC4\u59D4\u4E00\u770B\u5C31\u77E5\u9053\u201C\u8FD9\u50CF\u771F\u7684IDE\u201D\u3002"),

      heading3("\u4EAE\u70B92\uFF1AAI\u6807\u7B7E\u63A8\u8350\u7684Prompt\u5DE5\u7A0B\u4E0E\u964D\u7EA7\u7B56\u7565"),
      para("\u8BBE\u8BA1\u4E86\u7CBE\u5FC3\u7684Prompt\u6A21\u677F\uFF0C\u5C06\u4EE3\u7801\u524D500\u5B57\u7B26\u53D1\u9001\u7ED9DeepSeek\u8FDB\u884C\u5206\u6790\uFF0C\u8FD4\u56DE3-5\u4E2A\u7CBE\u51C6\u6807\u7B7E\u3002\u540C\u65F6\u8BBE\u8BA1\u4E8620\u6761\u672C\u5730\u89C4\u5219\u4F5C\u4E3A\u964D\u7EA7\u65B9\u6848\uFF0C\u5F53AI\u670D\u52A1\u4E0D\u53EF\u7528\u65F6\u81EA\u52A8\u56DE\u9000\uFF0C\u4FDD\u8BC1\u529F\u80FD\u7684\u53EF\u7528\u6027\u3002"),

      heading3("\u4EAE\u70B93\uFF1AECharts\u6570\u636E\u53EF\u89C6\u5316\u770B\u677F"),
      para("\u7EDF\u8BA1\u770B\u677F\u5305\u542B5\u79CDECharts\u56FE\u8868\uFF1A\u8BED\u8A00\u5206\u5E03\u997C\u56FE\u3001\u8FD114\u5929\u5B66\u4E60\u65F6\u957F\u67F1\u72B6\u56FE\u3001\u6D3B\u8DC3\u70ED\u529B\u56FE\uFF08\u7C7B\u4F3CGitHub\u8D21\u732E\u56FE\uFF09\u3001\u70ED\u95E8\u6807\u7B7ETOP10\u6A2A\u5411\u67F1\u72B6\u56FE\u3001\u5404\u8BED\u8A00\u5B66\u4E60\u65F6\u957F\u96F7\u8FBE\u56FE\u3002\u8BA9\u5B66\u4E60\u6570\u636E\u4E00\u76EE\u4E86\u7136\u3002"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== 四、核心功能模块说明 =====
      heading1("\u56DB\u3001\u6838\u5FC3\u529F\u80FD\u6A21\u5757\u8BF4\u660E"),

      heading2("4.1 \u4EE3\u7801\u7247\u6BB5\u5E93"),
      para("\u521B\u5EFA\u3001\u7F16\u8F91\u3001\u5206\u7C7B\u5B58\u50A8\u4EE3\u7801\u7247\u6BB5\uFF0C\u652F\u6301\u591A\u8BED\u8A00\u8BED\u6CD5\u9AD8\u4EAE\u548C\u6807\u7B7E\u7BA1\u7406\u3002\u5DE6\u4FA7\u5217\u8868\u5C55\u793A\u6240\u6709\u7247\u6BB5\uFF0C\u53F3\u4FA7\u96C6\u6210Monaco Editor\u63D0\u4F9B\u4E13\u4E1A\u7F16\u8F91\u4F53\u9A8C\u3002\u652F\u6301\u6309\u8BED\u8A00\u7B5B\u9009\u3001\u5173\u952E\u8BCD\u641C\u7D22\u548CAI\u8BED\u4E49\u641C\u7D22\u3002"),
      imageBlock(screenshotSnippets, 560, 320),
      caption("\u56FE1\uFF1A\u4EE3\u7801\u7247\u6BB5\u5E93\u754C\u9762"),

      heading2("4.2 \u5B66\u4E60\u65E5\u5FD7"),
      para("\u652F\u6301Markdown\u8BED\u6CD5\u7F16\u5199\u5B66\u4E60\u7B14\u8BB0\uFF0C\u5B9E\u65F6\u9884\u89C8\u6E32\u67D3\u3002\u8BB0\u5F55\u6BCF\u65E5\u5B66\u4E60\u5185\u5BB9\u3001\u5FC3\u5F97\u4E0E\u5B66\u4E60\u65F6\u957F\u3002\u652F\u6301\u65E5\u5FD7\u7684\u521B\u5EFA\u3001\u7F16\u8F91\u3001\u5220\u9664\u64CD\u4F5C\u3002"),
      imageBlock(screenshotLogs, 560, 320),
      caption("\u56FE2\uFF1A\u5B66\u4E60\u65E5\u5FD7\u754C\u9762"),

      heading2("4.3 \u7EDF\u8BA1\u770B\u677F"),
      para("\u57FA\u4E8EECharts\u7684\u6570\u636E\u53EF\u89C6\u5316\u770B\u677F\uFF0C\u5305\u542B\u603B\u89C8\u5361\u7247\uFF08\u4EE3\u7801\u7247\u6BB5\u6570\u3001\u65E5\u5FD7\u6570\u3001\u5B66\u4E60\u65F6\u957F\u3001\u6807\u7B7E\u6570\u3001\u6D3B\u8DC3\u5929\u6570\uFF09\u548C5\u79CD\u56FE\u8868\u3002\u8BA9\u7A0B\u5E8F\u5458\u7684\u6210\u957F\u8FC7\u7A0B\u53EF\u89C6\u5316\u3001\u53EF\u91CF\u5316\u3002"),
      imageBlock(screenshotDashboard, 560, 320),
      caption("\u56FE3\uFF1A\u7EDF\u8BA1\u770B\u677F\u754C\u9762"),

      heading2("4.4 AI\u667A\u80FD\u529F\u80FD"),
      bulletItem("AI\u667A\u80FD\u6807\u7B7E\uFF1A\u7C98\u8D34\u4EE3\u7801\u540E\u4E00\u952E\u5206\u6790\uFF0C\u81EA\u52A8\u63A8\u83503-5\u4E2A\u7CBE\u51C6\u6807\u7B7E"),
      bulletItem("AI\u8BED\u4E49\u641C\u7D22\uFF1A\u7528\u81EA\u7136\u8BED\u8A00\u641C\u7D22\u4EE3\u7801\uFF08\u5982\u201C\u90A3\u4E2A\u6392\u5E8F\u7684\u4EE3\u7801\u201D\uFF09"),
      bulletItem("\u964D\u7EA7\u7B56\u7565\uFF1AAI\u670D\u52A1\u8D85\u65F6/\u4E0D\u53EF\u7528\u65F6\uFF0C\u81EA\u52A8\u56DE\u9000\u4E3A\u672C\u5730\u5173\u952E\u8BCD\u5339\u914D\u641C\u7D22"),
      bulletItem("\u6807\u7B7E\u53BB\u91CD\u903B\u8F91\uFF1A\u81EA\u52A8\u8FC7\u6EE4\u91CD\u590D\u6807\u7B7E\uFF0C\u4FDD\u8BC1\u6807\u7B7E\u7684\u552F\u4E00\u6027"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== 五、数据库设计 =====
      heading1("\u4E94\u3001\u6570\u636E\u5E93\u8BBE\u8BA1"),

      heading2("5.1 \u7528\u6237\u8868 (users)"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2200, 2200, 4926],
        rows: [
          makeRow([{ text: "\u5B57\u6BB5", width: 2200 }, { text: "\u7C7B\u578B", width: 2200 }, { text: "\u8BF4\u660E", width: 4926 }], true),
          makeRow([{ text: "user_id", width: 2200 }, { text: "INT PK", width: 2200 }, { text: "\u7528\u6237ID\uFF0C\u81EA\u589E\u4E3B\u952E", width: 4926 }]),
          makeRow([{ text: "username", width: 2200 }, { text: "VARCHAR(50)", width: 2200 }, { text: "\u7528\u6237\u540D\uFF0C\u552F\u4E00\u7D22\u5F15", width: 4926 }]),
          makeRow([{ text: "password", width: 2200 }, { text: "VARCHAR(255)", width: 2200 }, { text: "\u52A0\u5BC6\u5BC6\u7801", width: 4926 }]),
          makeRow([{ text: "created_at", width: 2200 }, { text: "DATETIME", width: 2200 }, { text: "\u6CE8\u518C\u65F6\u95F4", width: 4926 }]),
        ]
      }),

      heading2("5.2 \u4EE3\u7801\u7247\u6BB5\u8868 (snippets)"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2200, 2200, 4926],
        rows: [
          makeRow([{ text: "\u5B57\u6BB5", width: 2200 }, { text: "\u7C7B\u578B", width: 2200 }, { text: "\u8BF4\u660E", width: 4926 }], true),
          makeRow([{ text: "snippet_id", width: 2200 }, { text: "INT PK", width: 2200 }, { text: "\u7247\u6BB5ID\uFF0C\u81EA\u589E\u4E3B\u952E", width: 4926 }]),
          makeRow([{ text: "user_id", width: 2200 }, { text: "INT FK", width: 2200 }, { text: "\u6240\u5C5E\u7528\u6237", width: 4926 }]),
          makeRow([{ text: "title", width: 2200 }, { text: "VARCHAR(200)", width: 2200 }, { text: "\u7247\u6BB5\u6807\u9898", width: 4926 }]),
          makeRow([{ text: "language", width: 2200 }, { text: "VARCHAR(30)", width: 2200 }, { text: "\u7F16\u7A0B\u8BED\u8A00", width: 4926 }]),
          makeRow([{ text: "code_content", width: 2200 }, { text: "TEXT", width: 2200 }, { text: "\u4EE3\u7801\u5185\u5BB9", width: 4926 }]),
          makeRow([{ text: "tags", width: 2200 }, { text: "VARCHAR(500)", width: 2200 }, { text: "\u6807\u7B7E\uFF08JSON\u6570\u7EC4\u5B57\u7B26\u4E32\uFF09", width: 4926 }]),
          makeRow([{ text: "created_at", width: 2200 }, { text: "DATETIME", width: 2200 }, { text: "\u521B\u5EFA\u65F6\u95F4", width: 4926 }]),
          makeRow([{ text: "updated_at", width: 2200 }, { text: "DATETIME", width: 2200 }, { text: "\u66F4\u65B0\u65F6\u95F4", width: 4926 }]),
        ]
      }),

      heading2("5.3 \u5B66\u4E60\u65E5\u5FD7\u8868 (study_logs)"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2200, 2200, 4926],
        rows: [
          makeRow([{ text: "\u5B57\u6BB5", width: 2200 }, { text: "\u7C7B\u578B", width: 2200 }, { text: "\u8BF4\u660E", width: 4926 }], true),
          makeRow([{ text: "log_id", width: 2200 }, { text: "INT PK", width: 2200 }, { text: "\u65E5\u5FD7ID\uFF0C\u81EA\u589E\u4E3B\u952E", width: 4926 }]),
          makeRow([{ text: "user_id", width: 2200 }, { text: "INT FK", width: 2200 }, { text: "\u6240\u5C5E\u7528\u6237", width: 4926 }]),
          makeRow([{ text: "title", width: 2200 }, { text: "VARCHAR(200)", width: 2200 }, { text: "\u65E5\u5FD7\u6807\u9898", width: 4926 }]),
          makeRow([{ text: "content", width: 2200 }, { text: "TEXT", width: 2200 }, { text: "Markdown\u5185\u5BB9", width: 4926 }]),
          makeRow([{ text: "study_hours", width: 2200 }, { text: "DECIMAL(3,1)", width: 2200 }, { text: "\u5B66\u4E60\u65F6\u957F\uFF08\u5C0F\u65F6\uFF09", width: 4926 }]),
          makeRow([{ text: "log_date", width: 2200 }, { text: "DATE", width: 2200 }, { text: "\u65E5\u671F", width: 4926 }]),
          makeRow([{ text: "created_at", width: 2200 }, { text: "DATETIME", width: 2200 }, { text: "\u521B\u5EFA\u65F6\u95F4", width: 4926 }]),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== 六、AI辅助编程工具使用说明 =====
      heading1("\u516D\u3001AI\u8F85\u52A9\u7F16\u7A0B\u5DE5\u5177\u4F7F\u7528\u8BF4\u660E"),

      para("\u672C\u4F5C\u54C1\u5728\u5F00\u53D1\u5168\u6D41\u7A0B\u4E2D\u5145\u5206\u5229\u7528AI\u8F85\u52A9\u7F16\u7A0B\u5DE5\u5177\uFF0C\u663E\u8457\u63D0\u5347\u4E86\u5F00\u53D1\u6548\u7387\u3002\u4EE5\u4E0B\u662F\u5404\u73AF\u8282\u7684\u8BE6\u7EC6\u8BF4\u660E\uFF1A"),
      emptyLine(),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [1800, 1800, 3226, 2500],
        rows: [
          makeRow([{ text: "\u5F00\u53D1\u73AF\u8282", width: 1800 }, { text: "\u4F7F\u7528\u5DE5\u5177", width: 1800 }, { text: "\u5177\u4F53\u505A\u4E86\u4EC0\u4E48", width: 3226 }, { text: "\u6548\u7387\u63D0\u5347", width: 2500 }], true),
          makeRow([{ text: "\u9879\u76EE\u521D\u59CB\u5316", width: 1800 }, { text: "Cursor + Vite", width: 1800 }, { text: "\u751F\u6210\u9879\u76EE\u811A\u624B\u67B6\u3001\u8DEF\u7531\u914D\u7F6E\u3001\u76EE\u5F55\u7ED3\u6784", width: 3226 }, { text: "\u7EA61\u5C0F\u65F6\u7701\u4E3A10\u5206\u949F", width: 2500 }]),
          makeRow([{ text: "Monaco Editor\u96C6\u6210", width: 1800 }, { text: "ChatGPT", width: 1800 }, { text: "\u63D0\u4F9B\u914D\u7F6E\u4EE3\u7801\u3001\u6697\u8272\u4E3B\u9898\u914D\u7F6E\u3001\u8BED\u8A00\u5207\u6362\u903B\u8F91", width: 3226 }, { text: "\u51CF\u5C11\u6587\u6863\u67E5\u9605\u65F6\u95F4", width: 2500 }]),
          makeRow([{ text: "\u6807\u7B7E\u63A8\u8350Prompt", width: 1800 }, { text: "DeepSeek", width: 1800 }, { text: "\u8FED\u4EE3\u4F18\u5316Prompt\u8BBE\u8BA1\uFF0C\u8FBE\u5230\u7A33\u5B9A\u8F93\u51FA\u683C\u5F0F", width: 3226 }, { text: "3\u6B21\u8C03\u8BD5\u5373\u6536\u655B", width: 2500 }]),
          makeRow([{ text: "\u6570\u636E\u5E93\u5EFA\u8868", width: 1800 }, { text: "Copilot", width: 1800 }, { text: "\u751F\u6210CREATE TABLE\u811A\u672C\u3001\u7D22\u5F15\u8BBE\u8BA1\u3001\u6D4B\u8BD5\u6570\u636E", width: 3226 }, { text: "\u7701\u53BB\u624B\u6572SQL", width: 2500 }]),
          makeRow([{ text: "ECharts\u56FE\u8868", width: 1800 }, { text: "ChatGPT", width: 1800 }, { text: "\u751F\u6210\u997C\u56FE\u3001\u67F1\u72B6\u56FE\u3001\u70ED\u529B\u56FE\u3001\u96F7\u8FBE\u56FE\u914D\u7F6E", width: 3226 }, { text: "\u56FE\u8868\u5F00\u53D1\u65F6\u95F4\u51CF\u534A", width: 2500 }]),
          makeRow([{ text: "\u6D4B\u8BD5\u6570\u636E", width: 1800 }, { text: "ChatGPT", width: 1800 }, { text: "\u751F\u6210100\u6761\u6A21\u62DF\u4EE3\u7801\u7247\u6BB5\u548C\u5B66\u4E60\u65E5\u5FD7", width: 3226 }, { text: "\u5FEB\u901F\u586B\u5145\u6570\u636E", width: 2500 }]),
          makeRow([{ text: "\u964D\u7EA7\u7B56\u7565", width: 1800 }, { text: "DeepSeek", width: 1800 }, { text: "\u8BBE\u8BA120\u6761\u672C\u5730\u89C4\u5219\u4F5C\u4E3AAI\u4E0D\u53EF\u7528\u65F6\u7684\u964D\u7EA7\u65B9\u6848", width: 3226 }, { text: "\u4FDD\u8BC1\u529F\u80FD\u53EF\u7528\u6027", width: 2500 }]),
          makeRow([{ text: "UI\u8BBE\u8BA1", width: 1800 }, { text: "ChatGPT", width: 1800 }, { text: "\u751F\u6210\u6697\u8272\u4E3B\u9898CSS\u3001\u5361\u7247\u5E03\u5C40\u3001\u52A8\u753B\u6548\u679C", width: 3226 }, { text: "\u89C6\u89C9\u8BBE\u8BA1\u65F6\u95F4\u8282\u770170%", width: 2500 }]),
        ]
      }),

      heading2("6.1 AI\u6807\u7B7E\u63A8\u8350Prompt\u8BBE\u8BA1"),
      para("\u6838\u5FC3Prompt\u6A21\u677F\uFF1A", { bold: true }),
      codeBlock("\u4F60\u662F\u4E00\u4F4D\u8D44\u6DF1\u4EE3\u7801\u5BA1\u67E5\u4E13\u5BB6\u3002\u8BF7\u5206\u6790\u4EE5\u4E0B\u4EE3\u7801\u7247\u6BB5\uFF0C\u751F\u62103-5\u4E2A\u7CBE\u51C6\u7684\u5206\u7C7B\u6807\u7B7E\u3002"),
      codeBlock("\u8981\u6C42\uFF1A1.\u6807\u7B7E\u7528\u4E2D\u6587  2.\u7B80\u6D01\u660E\u4E86  3.\u53EA\u8FD4\u56DEJSON\u6570\u7EC4\u683C\u5F0F"),
      emptyLine(),
      para("Prompt\u8BBE\u8BA1\u8981\u70B9\uFF1A"),
      bulletItem("\u89D2\u8272\u8BBE\u5B9A\uFF1A\u201C\u8D44\u6DF1\u4EE3\u7801\u5BA1\u67E5\u4E13\u5BB6\u201D\uFF0C\u5F15\u5BFCAI\u4ECE\u4E13\u4E1A\u89D2\u5EA6\u5206\u6790"),
      bulletItem("\u8F93\u51FA\u7EA6\u675F\uFF1A\u8981\u6C42JSON\u6570\u7EC4\u683C\u5F0F\uFF0C\u4FBF\u4E8E\u7A0B\u5E8F\u89E3\u6790"),
      bulletItem("\u957F\u5EA6\u63A7\u5236\uFF1A\u53EA\u53D6\u4EE3\u7801\u524D500\u5B57\u7B26\uFF0C\u63A7\u5236token\u6D88\u8017"),
      bulletItem("\u6E29\u5EA6\u8BBE\u7F6E\uFF1Atemperature=0.3\uFF0C\u4FDD\u8BC1\u8F93\u51FA\u7A33\u5B9A\u6027"),

      heading2("6.2 \u964D\u7EA7\u7B56\u7565\u8BBE\u8BA1"),
      para("\u5F53DeepSeek API\u4E0D\u53EF\u7528\u65F6\uFF08\u672A\u914D\u7F6EKey\u3001\u8D85\u65F6\u3001\u670D\u52A1\u5F02\u5E38\uFF09\uFF0C\u7CFB\u7EDF\u81EA\u52A8\u56DE\u9000\u5230\u672C\u5730\u89C4\u5219\u5F15\u64CE\u3002\u89C4\u5219\u5F15\u64CE\u5305\u542B20\u6761\u5173\u952E\u8BCD\u89C4\u5219\uFF0C\u8986\u76D6\u51FD\u6570\u3001\u7C7B\u3001\u5FAA\u73AF\u3001\u5F02\u6B65\u3001\u6570\u636E\u5E93\u3001React Hook\u3001CSS\u5E03\u5C40\u7B49\u5E38\u89C1\u7F16\u7A0B\u6982\u5FF5\uFF0C\u80FD\u5BF9\u5927\u591A\u6570\u5E38\u89C1\u4EE3\u7801\u7ED9\u51FA\u5408\u7406\u7684\u6807\u7B7E\u5EFA\u8BAE\u3002"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== 七、代码质量与工匠精神体现 =====
      heading1("\u4E03\u3001\u4EE3\u7801\u8D28\u91CF\u4E0E\u5DE5\u5320\u7CBE\u795E\u4F53\u73B0"),

      heading2("7.1 \u76EE\u5F55\u7ED3\u6784\u89C4\u8303"),
      codeBlock("GitNotes/"),
      codeBlock("\u251C\u2500\u2500 frontend/           # \u524D\u7AEF\u9879\u76EE"),
      codeBlock("\u2502   \u251C\u2500\u2500 src/"),
      codeBlock("\u2502   \u2502   \u251C\u2500\u2500 pages/       # \u9875\u9762\u7EC4\u4EF6"),
      codeBlock("\u2502   \u2502   \u2502   \u251C\u2500\u2500 Snippets.jsx   # \u4EE3\u7801\u7247\u6BB5\u9875"),
      codeBlock("\u2502   \u2502   \u2502   \u251C\u2500\u2500 StudyLogs.jsx  # \u5B66\u4E60\u65E5\u5FD7\u9875"),
      codeBlock("\u2502   \u2502   \u2502   \u2514\u2500\u2500 Dashboard.jsx  # \u7EDF\u8BA1\u770B\u677F\u9875"),
      codeBlock("\u2502   \u2502   \u251C\u2500\u2500 App.jsx       # \u4E3B\u5E94\u7528\u7EC4\u4EF6"),
      codeBlock("\u2502   \u2502   \u2514\u2500\u2500 App.css       # \u5168\u5C40\u6837\u5F0F"),
      codeBlock("\u2502   \u2514\u2500\u2500 package.json"),
      codeBlock("\u251C\u2500\u2500 backend/            # \u540E\u7AEF\u9879\u76EE"),
      codeBlock("\u2502   \u251C\u2500\u2500 server.js     # \u670D\u52A1\u5668\u5165\u53E3"),
      codeBlock("\u2502   \u251C\u2500\u2500 database.sql  # \u6570\u636E\u5E93\u521D\u59CB\u5316"),
      codeBlock("\u2502   \u2514\u2500\u2500 .env          # \u73AF\u5883\u53D8\u91CF"),
      codeBlock("\u2514\u2500\u2500 README.md"),

      heading2("7.2 \u547D\u540D\u89C4\u8303"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2500, 6826],
        rows: [
          makeRow([{ text: "\u7C7B\u578B", width: 2500 }, { text: "\u793A\u4F8B", width: 6826 }], true),
          makeRow([{ text: "\u7EC4\u4EF6\u540D", width: 2500 }, { text: "Snippets.jsx\u3001StudyLogs.jsx\u3001Dashboard.jsx", width: 6826 }]),
          makeRow([{ text: "API\u63A5\u53E3", width: 2500 }, { text: "POST /api/snippets\u3001GET /api/snippets/search?q=xxx", width: 6826 }]),
          makeRow([{ text: "\u6570\u636E\u5E93\u5B57\u6BB5", width: 2500 }, { text: "snippet_id\u3001user_id\u3001language\u3001code_content\u3001created_at", width: 6826 }]),
          makeRow([{ text: "CSS\u7C7B\u540D", width: 2500 }, { text: ".snippet-card\u3001.editor-panel\u3001.nav-item.active", width: 6826 }]),
        ]
      }),

      heading2("7.3 \u5173\u952E\u903B\u8F91\u6CE8\u91CA"),
      para("\u540E\u7AEF\u670D\u52A1\u4E2D\u7684\u5173\u952E\u51FD\u6570\u5747\u5305\u542BJSDoc\u6CE8\u91CA\uFF1A"),
      bulletItem("callDeepSeek() \u2014 \u8C03\u7528DeepSeek API\u8FDB\u884C\u4EE3\u7801\u5206\u6790\uFF0C\u5305\u542B\u53C2\u6570\u8BF4\u660E\u548C\u8FD4\u56DE\u503C\u8BF4\u660E"),
      bulletItem("localTagEngine() \u2014 \u672C\u5730\u89C4\u5219\u5F15\u64CE\uFF0C\u5305\u542B20\u6761\u89C4\u5219\u7684\u8BE6\u7EC6\u8BF4\u660E"),
      bulletItem("AI\u6807\u7B7E\u89E3\u6790\u903B\u8F91 \u2014 \u5305\u542BJSON\u89E3\u6790\u5931\u8D25\u65F6\u7684\u964D\u7EA7\u5904\u7406\u8BF4\u660E"),

      heading2("7.4 \u9519\u8BEF\u5904\u7406\u8BBE\u8BA1"),
      bulletItem("\u5168\u5C40\u5F02\u5E38\u6355\u83B7\uFF1A\u540E\u7AEF\u6BCF\u4E2AAPI\u63A5\u53E3\u5747\u5305\u542Btry-catch"),
      bulletItem("API\u8D85\u65F6\u8BBE\u7F6E\uFF1ADeepSeek API\u8BBE\u7F6E10\u79D2\u8D85\u65F6"),
      bulletItem("\u524D\u7AEF\u63D0\u793A\uFF1A\u64CD\u4F5C\u6210\u529F/\u5931\u8D25\u5747\u6709\u53CB\u597D\u7684\u6D88\u606F\u63D0\u793A"),
      bulletItem("\u964D\u7EA7\u7B56\u7565\uFF1AAI\u670D\u52A1\u4E0D\u53EF\u7528\u65F6\u81EA\u52A8\u56DE\u9000\u4E3A\u672C\u5730\u5F15\u64CE"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== 八、部署说明 =====
      heading1("\u516B\u3001\u90E8\u7F72\u8BF4\u660E"),

      heading2("8.1 \u73AF\u5883\u8981\u6C42"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2500, 6826],
        rows: [
          makeRow([{ text: "\u73AF\u5883", width: 2500 }, { text: "\u8981\u6C42", width: 6826 }], true),
          makeRow([{ text: "Node.js", width: 2500 }, { text: "v16.0 \u53CA\u4EE5\u4E0A\u7248\u672C", width: 6826 }]),
          makeRow([{ text: "MySQL", width: 2500 }, { text: "v5.7 \u53CA\u4EE5\u4E0A\u7248\u672C\uFF08\u53EF\u9009\uFF0C\u652F\u6301\u6A21\u62DF\u6570\u636E\u6A21\u5F0F\uFF09", width: 6826 }]),
          makeRow([{ text: "npm", width: 2500 }, { text: "v8.0 \u53CA\u4EE5\u4E0A\u7248\u672C", width: 6826 }]),
          makeRow([{ text: "DeepSeek API Key", width: 2500 }, { text: "\u53EF\u9009\uFF0C\u672A\u914D\u7F6E\u65F6\u4F7F\u7528\u672C\u5730\u964D\u7EA7\u5F15\u64CE", width: 6826 }]),
        ]
      }),

      heading2("8.2 \u5FEB\u901F\u542F\u52A8"),
      heading3("\u6B65\u9AA41\uFF1A\u514B\u9686\u9879\u76EE"),
      codeBlock("git clone <\u9879\u76EE\u5730\u5740>"),
      codeBlock("cd GitNotes"),

      heading3("\u6B65\u9AA42\uFF1A\u521D\u59CB\u5316\u6570\u636E\u5E93\uFF08\u53EF\u9009\uFF09"),
      codeBlock("mysql -u root -p < backend/database.sql"),

      heading3("\u6B65\u9AA43\uFF1A\u542F\u52A8\u540E\u7AEF\u670D\u52A1"),
      codeBlock("cd backend"),
      codeBlock("npm install"),
      codeBlock("# \u914D\u7F6E .env \u6587\u4EF6\u4E2D\u7684\u6570\u636E\u5E93\u4FE1\u606F\u548CAI_API_KEY"),
      codeBlock("npm start"),
      para("\u670D\u52A1\u5668\u5C06\u5728 http://localhost:3001 \u8FD0\u884C"),

      heading3("\u6B65\u9AA44\uFF1A\u542F\u52A8\u524D\u7AEF\u5E94\u7528"),
      codeBlock("cd frontend"),
      codeBlock("npm install"),
      codeBlock("npm run dev"),
      para("\u5E94\u7528\u5C06\u5728 http://localhost:5173 \u8FD0\u884C"),

      heading2("8.3 \u751F\u4EA7\u90E8\u7F72\uFF08\u53C2\u8003\uFF09"),
      bulletItem("\u524D\u7AEF\uFF1Anpm run build \u2192 \u751F\u6210dist\u76EE\u5F55 \u2192 Nginx\u9759\u6001\u90E8\u7F72"),
      bulletItem("\u540E\u7AEF\uFF1ANode.js + PM2\u5B88\u62A4\u8FDB\u7A0B"),
      bulletItem("\u6570\u636E\u5E93\uFF1AMySQL\u521D\u59CB\u5316\u811A\u672C\u4E00\u952E\u6267\u884C"),
      bulletItem("AI\u670D\u52A1\uFF1A\u9700\u8981\u914D\u7F6E\u597DAPI Key\u73AF\u5883\u53D8\u91CF"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== 九、开源组件说明 =====
      heading1("\u4E5D\u3001\u5F00\u6E90\u7EC4\u4EF6\u8BF4\u660E"),
      para("\u672C\u4F5C\u54C1\u4E3A\u539F\u521B\u5F00\u53D1\uFF0C\u4EE5\u4E0B\u5F00\u6E90\u7EC4\u4EF6\u5747\u5DF2\u5728\u6E90\u7801\u548C\u6587\u6863\u4E2D\u6CE8\u660E\u6765\u6E90\uFF1A"),
      emptyLine(),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2500, 2000, 4826],
        rows: [
          makeRow([{ text: "\u7EC4\u4EF6", width: 2500 }, { text: "\u5F00\u6E90\u534F\u8BAE", width: 2000 }, { text: "\u7528\u9014", width: 4826 }], true),
          makeRow([{ text: "React", width: 2500 }, { text: "MIT", width: 2000 }, { text: "\u524D\u7AEFUI\u6846\u67B6", width: 4826 }]),
          makeRow([{ text: "Monaco Editor", width: 2500 }, { text: "MIT", width: 2000 }, { text: "\u4EE3\u7801\u7F16\u8F91\u5668\u7EC4\u4EF6\uFF08VS Code\u5185\u6838\uFF09", width: 4826 }]),
          makeRow([{ text: "ECharts", width: 2500 }, { text: "Apache-2.0", width: 2000 }, { text: "\u6570\u636E\u53EF\u89C6\u5316\u56FE\u8868\u5E93", width: 4826 }]),
          makeRow([{ text: "Express", width: 2500 }, { text: "MIT", width: 2000 }, { text: "\u540E\u7AEFWeb\u670D\u52A1\u6846\u67B6", width: 4826 }]),
          makeRow([{ text: "Axios", width: 2500 }, { text: "MIT", width: 2000 }, { text: "HTTP\u8BF7\u6C42\u5BA2\u6237\u7AEF", width: 4826 }]),
          makeRow([{ text: "mysql2", width: 2500 }, { text: "MIT", width: 2000 }, { text: "MySQL\u6570\u636E\u5E93\u9A71\u52A8", width: 4826 }]),
          makeRow([{ text: "Vite", width: 2500 }, { text: "MIT", width: 2000 }, { text: "\u524D\u7AEF\u6784\u5EFA\u5DE5\u5177", width: 4826 }]),
          makeRow([{ text: "DeepSeek API", width: 2500 }, { text: "\u5546\u4E1AAPI", width: 2000 }, { text: "AI\u6807\u7B7E\u63A8\u8350\u4E0E\u8BED\u4E49\u641C\u7D22", width: 4826 }]),
        ]
      }),

      emptyLine(), emptyLine(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [new TextRun({ text: "\u2014 \u5168\u6587\u5B8C \u2014", font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" }, size: 24, color: "999999" })]
      }),
    ]
  }]
});

// 生成文档
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("docs/Git\u7B14\u8BB0-\u8BBE\u8BA1\u6587\u6863.docx", buffer);
  console.log("\u2713 \u8BBE\u8BA1\u6587\u6863\u5DF2\u751F\u6210: docs/Git\u7B14\u8BB0-\u8BBE\u8BA1\u6587\u6863.docx");
});
