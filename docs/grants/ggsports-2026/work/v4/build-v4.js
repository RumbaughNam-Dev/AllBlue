// AllBlue — 2026 경기스포츠산업 공모전 발표자료 v4
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const lu = require("react-icons/lu");

const SKILL = process.env.PPTX_SKILL;
const { applyTheme } = require(path.join(SKILL, "scripts/apply_theme.js"));

const A = path.join(__dirname, "..", "assets");
const OUT = process.argv[2];

const THEME = {
  name: "AllBlue Deep Sea",
  headFontFace: "Malgun Gothic",
  bodyFontFace: "Malgun Gothic",
  colors: {
    dk1: "0F2A44", lt1: "FFFFFF", dk2: "0A2540", lt2: "F2F6FA",
    accent1: "2EC4E8", accent2: "1B4F8A", accent3: "F2A33A",
    accent4: "5D738A", accent5: "9FC3DE", accent6: "DCEAF5",
    hlink: "1B4F8A", folHlink: "5D738A",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "AllBlue - 프리다이빙 교육 운영 서비스";
pres.author = "럼바우 남상현";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const INK = C.text1, NAVY = C.text2, WHITE = C.background1, PALE = C.background2;
const CYAN = C.accent1, OCEAN = C.accent2, AMBER = C.accent3, MUTED = C.accent4, STEEL = C.accent5, ICE = C.accent6;

const W = 13.333, MX = 0.6, CW = W - 2 * MX;

// ---------- icons ----------
async function icon(name, color, size = 256) {
  const Comp = lu[name];
  if (!Comp) throw new Error("missing icon " + name);
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
const shadow = () => ({ type: "outer", color: "0A2540", opacity: 0.14, blur: 10, offset: 3, angle: 90 });

// ---------- layouts ----------
const footer = (dark) => [
  { text: { text: "AllBlue  ·  2026 경기스포츠산업 공모전", options: { x: MX, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: dark ? STEEL : MUTED, margin: 0 } } },
];
function layout(name, dark) {
  pres.defineSlideMaster({
    title: name,
    background: { path: path.join(A, dark ? "bg_dark.png" : "bg_light.png") },
    objects: [
      ...footer(dark),
      { placeholder: { options: { name: "kicker", type: "body", x: MX, y: 0.38, w: 8, h: 0.32, fontSize: 13, bold: true, color: dark ? CYAN : OCEAN, margin: 0, charSpacing: 1 }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: MX, y: 0.72, w: CW, h: 0.8, fontSize: 32, bold: true, color: dark ? WHITE : INK, margin: 0, valign: "middle", align: "left" }, text: "" } },
    ],
    slideNumber: { x: W - MX - 0.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: dark ? STEEL : MUTED, align: "right" },
  });
}
layout("DARK", true);
layout("LIGHT", false);
pres.defineSlideMaster({ title: "COVER", background: { path: path.join(A, "bg_dark.png") }, objects: [] });

function slide(master, section, kicker, title, notes) {
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  if (kicker) s.addText(kicker, { placeholder: "kicker" });
  if (title) s.addText(title, { placeholder: "title" });
  s.addNotes(notes);
  return s;
}
const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, valign: "top", ...o });
const PH = 1935 / 921; // phone mockup aspect (h/w)
function phone(s, file, x, y, h, extra = {}) {
  const w = h / PH;
  s.addImage({ path: path.join(A, file), x, y, w, h, altText: "AllBlue 앱 화면", objectName: "phone " + file, ...extra });
  return w;
}
function card(s, x, y, w, h, fill, name, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.14, fill: { color: fill, ...(opts.transparency != null ? { transparency: opts.transparency } : {}) }, line: opts.line || { type: "none" }, shadow: opts.noShadow ? undefined : shadow(), objectName: name });
}
async function iconDot(s, name, x, y, d, bg, fg, objName) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { type: "none" }, objectName: objName + " circle" });
  const p = d * 0.27;
  s.addImage({ data: await icon(name, fg), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: objName, objectName: objName + " icon" });
}
function numDot(s, n, x, y, d, bg, fg, size = 14) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { type: "none" }, objectName: "number " + n });
  T(s, String(n), { x, y, w: d, h: d, fontSize: size, bold: true, color: fg, align: "center", valign: "middle" });
}

(async () => {
  // =============== 1. COVER ===============
  pres.addSection({ title: "도입" });
  let s = pres.addSlide({ masterName: "COVER", sectionTitle: "도입" });
  s.addNotes("[20초] 안녕하세요, 럼바우 대표 남상현입니다. AllBlue는 프리다이빙 강사의 수업 일정, 교육생 진도, 수업 후 피드백을 하나로 연결하는 앱입니다. 현재 정식 출시 전이며 2026년 10월 안에 출시할 예정입니다.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 0.9, w: 2.55, h: 0.42, rectRadius: 0.21, fill: { color: CYAN, transparency: 82 }, line: { color: CYAN, width: 1 }, objectName: "category chip" });
  T(s, "대회 운영 · 관리 기술", { x: MX, y: 0.9, w: 2.55, h: 0.42, fontSize: 12, bold: true, color: CYAN, align: "center", valign: "middle" });
  T(s, "AllBlue", { x: MX, y: 1.75, w: 7, h: 1.4, fontSize: 80, bold: true, color: WHITE, valign: "middle" });
  T(s, [
    { text: "프리다이빙 교육,", options: { breakLine: true } },
    { text: "수업 다음까지 ", options: {} },
    { text: "이어지게", options: { color: CYAN } },
  ], { x: MX, y: 3.3, w: 7, h: 1.5, fontSize: 36, bold: true, color: WHITE });
  T(s, "일정 · 교육생 진도 · 수업 피드백을 하나로 잇는\n강사용 교육 운영 앱", { x: MX, y: 4.9, w: 6.6, h: 0.75, fontSize: 16, color: ICE });
  T(s, [
    { text: "2026 경기스포츠산업 공모전", options: { breakLine: true, color: STEEL } },
    { text: "럼바우  |  대표 남상현", options: { bold: true, color: WHITE } },
  ], { x: MX, y: 6.0, w: 6, h: 0.8, fontSize: 14 });
  // fanned phones
  phone(s, "06_feature_4.png", 7.35, 1.55, 4.9, { rotate: -9 });
  phone(s, "03_feature_1.png", 10.45, 1.55, 4.9, { rotate: 9 });
  phone(s, "05_feature_3.png", 8.85, 1.0, 5.6, { shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 18, offset: 6, angle: 90 } });

  // =============== 2. SUMMARY ===============
  s = slide("LIGHT", "도입", "SUMMARY", "한눈에 보는 AllBlue",
    "[30초] 발표 내용을 먼저 요약하겠습니다. 문제는 흩어진 교육 기록입니다. 해결책은 한 번의 수업에 필요한 기록을 앱 안에서 연결하는 것이고, 강사에게 월 3,900원 구독료를 받는 모델입니다. 개발은 마쳤고 운영 환경에서 테스트 중이며 10월 안에 정식 출시합니다.");
  const sumW = (CW - 2 * 0.3) / 3;
  const sums = [
    ["LuSearch", "문제", "흩어진 교육 기록", "진도는 엑셀에, 일정 안내와\n서류·피드백은 따로.\n한 교육생의 정보를\n여러 곳에서 찾아야 합니다."],
    ["LuLink", "해결", "수업 하나에 기록을 연결", "일정·참가자·서류 상태\n과정별 진도·디브리핑을\n수업 단위로 모아 봅니다."],
    ["LuWallet", "사업 모델", "강사 월 3,900원 구독", "최초 3개월 무료,\n교육생은 무료.\n협업 유튜브 채널로\n초기 강사를 모읍니다."],
  ];
  for (let i = 0; i < 3; i++) {
    const x = MX + i * (sumW + 0.3), y = 1.8;
    card(s, x, y, sumW, 3.55, WHITE, "summary card " + (i + 1));
    await iconDot(s, sums[i][0], x + 0.35, y + 0.35, 0.75, i === 1 ? OCEAN : ICE, i === 1 ? "FFFFFF" : HEX.accent2, "summary " + sums[i][1]);
    T(s, sums[i][1], { x: x + 0.35, y: y + 1.3, w: sumW - 0.7, h: 0.3, fontSize: 12, bold: true, color: MUTED });
    T(s, sums[i][2], { x: x + 0.35, y: y + 1.62, w: sumW - 0.7, h: 0.5, fontSize: 20, bold: true, color: INK });
    T(s, sums[i][3], { x: x + 0.35, y: y + 2.2, w: sumW - 0.7, h: 1.3, fontSize: 14, color: MUTED, lineSpacingMultiple: 1.15 });
  }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 5.7, w: CW, h: 0.95, rectRadius: 0.14, fill: { color: NAVY }, line: { type: "none" }, objectName: "status panel" });
  const stats = [["개발 완료", "운영 환경 테스트 중"], ["2026년 10월", "정식 출시 예정"], ["개발 14년차", "프리다이빙 3년차"]];
  for (let i = 0; i < 3; i++) {
    const x = MX + 0.45 + i * (CW / 3);
    s.addShape(pres.shapes.OVAL, { x, y: 6.1, w: 0.13, h: 0.13, fill: { color: i === 1 ? AMBER : CYAN }, line: { type: "none" }, objectName: "status dot " + i });
    T(s, [{ text: stats[i][0] + "  ", options: { bold: true, color: WHITE } }, { text: stats[i][1], options: { color: STEEL } }], { x: x + 0.28, y: 5.7, w: CW / 3 - 0.5, h: 0.95, fontSize: 15, valign: "middle" });
  }

  // =============== 3. PROBLEM ===============
  pres.addSection({ title: "문제와 해결" });
  s = slide("LIGHT", "문제와 해결", "01  문제", "한 교육생의 기록이 여러 곳에 흩어져 있습니다",
    "[45초] 프리다이빙 교육 현장에서 교육생 진도를 엑셀로 관리하는 경우를 많이 보았습니다. 일정 안내, 면책동의서와 의료진술서, 수업 후 피드백까지 따로 관리하면 한 교육생의 정보를 여러 곳에서 찾아야 합니다. 수업 전에는 지난 진도를 찾고, 수업 후에는 배운 내용을 정리하고, 다음 수업 때 기록을 다시 확인합니다. 이 반복 업무에서 AllBlue가 출발했습니다. 이는 대표자와 협업 강사의 현장 관찰이며 업계 전체 통계는 아닙니다.");
  const cx = 3.8, cy = 4.15;
  const spots = [
    [0.6, 1.85, "LuSheet", "교육 진도", "엑셀 표"],
    [4.4, 1.85, "LuCalendarDays", "일정 안내·참석", "별도 연락"],
    [0.6, 5.45, "LuFileText", "동의서·진술서", "별도 서류"],
    [4.4, 5.45, "LuStickyNote", "수업 피드백", "별도 메모"],
  ];
  for (const [x, y] of spots) {
    s.addShape(pres.shapes.LINE, { x: Math.min(x + 1.3, cx), y: Math.min(y + 0.5, cy), w: Math.abs(x + 1.3 - cx), h: Math.abs(y + 0.5 - cy), flipH: (x + 1.3 > cx) !== (y + 0.5 > cy), line: { color: STEEL, width: 1.5, dashType: "dash" }, objectName: "connector" });
  }
  for (const [x, y, ic, a, b] of spots) {
    card(s, x, y, 2.6, 1.0, WHITE, "scattered " + a);
    await iconDot(s, ic, x + 0.2, y + 0.2, 0.6, ICE, HEX.accent2, a);
    T(s, a, { x: x + 0.95, y: y + 0.2, w: 1.6, h: 0.32, fontSize: 14, bold: true, color: INK });
    T(s, b, { x: x + 0.95, y: y + 0.54, w: 1.6, h: 0.28, fontSize: 12, color: MUTED });
  }
  s.addShape(pres.shapes.OVAL, { x: cx - 0.8, y: cy - 0.8, w: 1.6, h: 1.6, fill: { color: AMBER }, line: { color: WHITE, width: 4 }, shadow: shadow(), objectName: "student hub" });
  s.addImage({ data: await icon("LuUser", "FFFFFF"), x: cx - 0.25, y: cy - 0.58, w: 0.5, h: 0.5, altText: "교육생", objectName: "student icon" });
  T(s, "교육생 한 명", { x: cx - 0.8, y: cy, w: 1.6, h: 0.35, fontSize: 13, bold: true, color: WHITE, align: "center" });
  const pains = [["수업 전", "지난 진도를 다시 찾고"], ["수업 후", "배운 내용을 따로 정리하고"], ["다음 수업", "기록을 또 확인합니다"]];
  for (let i = 0; i < 3; i++) {
    const y = 1.95 + i * 0.95;
    numDot(s, i + 1, 7.7, y + 0.1, 0.55, i === 2 ? AMBER : OCEAN, WHITE, 16);
    T(s, pains[i][0], { x: 8.5, y, w: 4, h: 0.3, fontSize: 12, bold: true, color: MUTED });
    T(s, pains[i][1], { x: 8.5, y: y + 0.3, w: 4.2, h: 0.45, fontSize: 20, bold: true, color: INK });
  }
  card(s, 7.7, 4.95, 5.03, 1.35, ICE, "quote box", { noShadow: true });
  T(s, "“진도는 엑셀에,\n다음 수업 준비는 다시.”", { x: 8.0, y: 4.95, w: 4.6, h: 1.35, fontSize: 22, bold: true, color: OCEAN, valign: "middle" });
  T(s, "대표자·협업 강사의 현장 관찰 기반 문제 정의 (업계 통계 아님)", { x: 7.7, y: 6.45, w: 5.03, h: 0.3, fontSize: 10, color: MUTED });

  // =============== 4. SOLUTION ===============
  s = slide("DARK", "문제와 해결", "02  해결", "수업 단위로 이어지는 다섯 단계",
    "[35초] AllBlue는 한 번의 수업을 중심으로 기록을 모읍니다. 강사가 일정을 만들고 교육생을 초대하면 교육생이 참석 여부를 응답합니다. 일정 상세에서 참가자별 서류 상태와 교육 진도를 확인하고, 수업 뒤에는 이수 항목과 디브리핑을 남겨 다음 수업에서 다시 참고합니다.");
  const steps = [
    ["LuCalendarDays", "수업 준비", "일정 작성·초대\n참석 응답 확인"],
    ["LuShieldCheck", "서류 확인", "면책동의서·\n의료진술서\n서명 상태 확인"],
    ["LuClipboardCheck", "교육 기록", "과정별 요건\n완료 상태 관리"],
    ["LuPenLine", "수업 마무리", "디브리핑 작성\n이전 기록 조회"],
    ["LuUsers", "관계 관리", "강사·교육생\n그룹으로 연결"],
  ];
  const stW = (CW - 4 * 0.3) / 5;
  for (let i = 0; i < 5; i++) {
    const x = MX + i * (stW + 0.3), y = 1.95;
    card(s, x, y, stW, 3.15, WHITE, "step card " + (i + 1), { transparency: 90, noShadow: true, line: { color: STEEL, width: 0.75, transparency: 60 } });
    await iconDot(s, steps[i][0], x + 0.3, y + 0.35, 0.8, i === 3 ? AMBER : CYAN, HEX.dk2, steps[i][1]);
    T(s, "STEP " + (i + 1), { x: x + 0.3, y: y + 1.35, w: stW - 0.5, h: 0.28, fontSize: 11, bold: true, color: CYAN, charSpacing: 1 });
    T(s, steps[i][1], { x: x + 0.3, y: y + 1.65, w: stW - 0.5, h: 0.42, fontSize: 20, bold: true, color: WHITE });
    T(s, steps[i][2], { x: x + 0.3, y: y + 2.15, w: stW - 0.45, h: 0.9, fontSize: 14, color: ICE, lineSpacingMultiple: 1.1 });
    if (i < 4) s.addImage({ data: await icon("LuChevronRight", HEX.accent1), x: x + stW + 0.02, y: y + 1.45, w: 0.26, h: 0.26, altText: "다음 단계", objectName: "step arrow " + i });
  }
  await iconDot(s, "LuRepeat", MX, 5.6, 0.75, AMBER, HEX.dk2, "loop");
  T(s, [{ text: "수업이 끝난 기록이 ", options: {} }, { text: "다음 수업의 출발점", options: { color: CYAN } }, { text: "이 됩니다", options: {} }],
    { x: MX + 1.0, y: 5.55, w: 10, h: 0.85, fontSize: 26, bold: true, color: WHITE, valign: "middle" });

  // =============== 5. FEATURE — BEFORE CLASS ===============
  pres.addSection({ title: "제품" });
  s = slide("LIGHT", "제품", "03  핵심 기능 · 수업 전", "일정과 참가자, 서류까지 한 곳에서",
    "[40초] 수업 전 화면입니다. 월간 캘린더에서 한 달의 수업 일정을 보고, 날짜별 수업과 참여 교육생을 확인합니다. 일정 상세에서는 교육생별 면책동의서와 의료진술서 제출 상태를 확인하고 URL로 공유할 수 있습니다. 화면은 실제 앱 화면입니다.");
  const f1 = [["10_feature_8.png", "월간 캘린더", "한 달의 수업 일정을\n달력에서 한눈에 확인합니다."],
              ["04_feature_2.png", "일정 · 참여 교육생", "날짜별 수업과 참여 교육생,\n초대 응답을 확인합니다."],
              ["07_feature_5.png", "서류 현황", "교육생별 동의서·진술서 상태를\n확인하고 URL로 공유합니다."]];
  for (let i = 0; i < 3; i++) {
    const x = MX + 0.15 + i * 2.5;
    phone(s, f1[i][0], x, 1.75, 4.75);
    numDot(s, i + 1, x - 0.15, 1.6, 0.5, AMBER, WHITE, 15);
  }
  for (let i = 0; i < 3; i++) {
    const y = 1.9 + i * 1.55;
    card(s, 8.25, y, 4.48, 1.3, WHITE, "feature row " + (i + 1));
    numDot(s, i + 1, 8.5, y + 0.3, 0.5, AMBER, WHITE, 15);
    T(s, f1[i][1], { x: 9.2, y: y + 0.22, w: 3.35, h: 0.38, fontSize: 18, bold: true, color: INK });
    T(s, f1[i][2], { x: 9.2, y: y + 0.6, w: 3.35, h: 0.62, fontSize: 13, color: MUTED });
  }

  // =============== 6. FEATURE — AFTER CLASS ===============
  s = slide("DARK", "제품", "03  핵심 기능 · 수업 후", "진도 체크와 디브리핑을 그 자리에서",
    "[40초] 수업 후 화면입니다. 교육생마다 AIDA 과정별 개방수역과 풀 요건을 항목별로 체크합니다. 수업이 끝나면 통과 처리와 피드백 메모를 한 화면에서 기록하고, 다음 수업 준비 때 다시 조회합니다. 앱은 기록 도구이며 교육과 자격 판단은 강사가 맡습니다.");
  phone(s, "05_feature_3.png", MX + 0.2, 1.7, 4.95);
  phone(s, "06_feature_4.png", MX + 2.75, 1.7, 4.95);
  T(s, [{ text: "지난 수업이", options: { breakLine: true } }, { text: "다음 수업의 ", options: {} }, { text: "출발점", options: { color: CYAN } }, { text: "이 되도록", options: {} }],
    { x: 6.3, y: 1.75, w: 6.4, h: 1.25, fontSize: 30, bold: true, color: WHITE, lineSpacingMultiple: 1.05 });
  const f2 = [["LuClipboardCheck", "과정별 요건 체크", "AIDA 과정의 개방수역·풀 요건을 항목별로\n완료 표시하고 진행 상황을 봅니다."],
              ["LuPenLine", "수업 직후 디브리핑", "통과 처리와 피드백 메모를 한 화면에 남기고,\n다음 수업 전에 다시 꺼내 봅니다."]];
  for (let i = 0; i < 2; i++) {
    const y = 3.3 + i * 1.5;
    card(s, 6.3, y, 6.43, 1.25, WHITE, "after card " + (i + 1), { transparency: 90, noShadow: true, line: { color: STEEL, width: 0.75, transparency: 60 } });
    await iconDot(s, f2[i][0], 6.55, y + 0.25, 0.75, CYAN, HEX.dk2, f2[i][1]);
    T(s, f2[i][1], { x: 7.55, y: y + 0.17, w: 5.0, h: 0.38, fontSize: 18, bold: true, color: WHITE });
    T(s, f2[i][2], { x: 7.55, y: y + 0.55, w: 5.0, h: 0.62, fontSize: 13, color: ICE });
  }
  T(s, "교육·자격 판단은 강사가 수행하며, 앱은 교육단체의 공식 자격 발급을 대신하지 않습니다.", { x: 6.3, y: 6.35, w: 6.43, h: 0.3, fontSize: 10, color: STEEL });

  // =============== 7. DEMO ===============
  s = slide("LIGHT", "제품", "04  시연", "45초 시연: 한 번의 수업 따라가기",
    "[60초, 시연 45초 포함] 이제 실제 앱으로 한 번의 수업을 따라가 보겠습니다. 테스트용 일정을 선택하고, 참여 교육생과 서류 상태를 확인한 뒤, 과정별 진도를 보고, 디브리핑을 저장하겠습니다. 네트워크가 불안정하면 이 화면과 앞의 캡처로 설명합니다.");
  const demo = [["0–10초", "테스트 일정 선택", "캘린더에서 오늘의 수업을 엽니다"],
                ["10–20초", "참여 교육생 · 서류 확인", "참석 응답과 동의서 상태를 봅니다"],
                ["20–35초", "과정별 진도 확인", "교육생의 개방수역·풀 요건을 체크합니다"],
                ["35–45초", "디브리핑 저장", "피드백을 남기고 다음 수업에 연결합니다"]];
  s.addShape(pres.shapes.LINE, { x: MX + 0.3, y: 2.15, w: 0, h: 3.9, line: { color: STEEL, width: 2 }, objectName: "demo timeline" });
  for (let i = 0; i < 4; i++) {
    const y = 1.85 + i * 1.3;
    numDot(s, i + 1, MX, y, 0.6, i === 3 ? AMBER : OCEAN, WHITE, 16);
    T(s, demo[i][0], { x: MX + 0.9, y: y - 0.02, w: 1.3, h: 0.3, fontSize: 12, bold: true, color: i === 3 ? AMBER : OCEAN });
    T(s, demo[i][1], { x: MX + 0.9, y: y + 0.28, w: 6.0, h: 0.42, fontSize: 20, bold: true, color: INK });
    T(s, demo[i][2], { x: MX + 0.9, y: y + 0.72, w: 6.0, h: 0.32, fontSize: 14, color: MUTED });
  }
  card(s, 8.0, 1.75, 4.73, 4.95, NAVY, "demo stage");
  phone(s, "08_feature_6.png", 8.35, 2.05, 4.35);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.75, y: 2.25, w: 1.65, h: 0.48, rectRadius: 0.24, fill: { color: AMBER }, line: { type: "none" }, objectName: "live chip" });
  s.addImage({ data: await icon("LuPlay", HEX.dk2), x: 10.92, y: 2.36, w: 0.26, h: 0.26, altText: "재생", objectName: "live icon" });
  T(s, "LIVE DEMO", { x: 11.22, y: 2.25, w: 1.15, h: 0.48, fontSize: 12, bold: true, color: NAVY, valign: "middle" });
  T(s, [{ text: "그날의 수업,", options: { breakLine: true } }, { text: "타임라인으로", options: {} }], { x: 10.75, y: 3.1, w: 1.85, h: 0.9, fontSize: 16, bold: true, color: WHITE });
  T(s, "장소·분류·교육생을\n시간 순으로 정리", { x: 10.75, y: 4.05, w: 1.8, h: 0.9, fontSize: 12, color: STEEL });

  // =============== 8. DIFFERENTIATION ===============
  pres.addSection({ title: "사업" });
  s = slide("LIGHT", "사업", "05  차별점", "교육 콘텐츠가 아닌, 강사의 수업 운영에 집중",
    "[30초] 엑셀과 메신저는 익숙하지만 기록이 흩어집니다. 다이빙 분야에는 MySSI처럼 디지털 교육, 자격증과 로그북을 제공하는 앱이 있습니다. AllBlue는 강사가 매번 반복하는 수업 운영, 즉 참석과 서류 확인, 진도와 피드백이 자연스럽게 이어지는지에 집중합니다. 출시 후에는 같은 수업을 기존 도구와 AllBlue로 준비해 비교하겠습니다.");
  const cmpW = 3.75, cmpY = 1.85, cmpH = 3.9;
  const cmp = [
    ["LuSheet", "기존 방식", "엑셀 · 메신저 · 별도 서류", [["장점", "자유롭고 익숙한 도구"], ["한계", "한 교육생 정보가 여러 곳에 흩어짐"]]],
    ["LuGraduationCap", "교육단체 앱", "예: MySSI ¹", [["초점", "디지털 교육 · 자격증 · 로그북"], ["대상", "교육 콘텐츠와 자격 이력 관리"]]],
  ];
  for (let i = 0; i < 2; i++) {
    const x = MX + i * (cmpW + 0.3);
    card(s, x, cmpY, cmpW, cmpH, WHITE, "compare " + cmp[i][1]);
    await iconDot(s, cmp[i][0], x + 0.35, cmpY + 0.35, 0.7, ICE, HEX.accent2, cmp[i][1]);
    T(s, cmp[i][1], { x: x + 0.35, y: cmpY + 1.2, w: cmpW - 0.7, h: 0.42, fontSize: 20, bold: true, color: INK });
    T(s, cmp[i][2], { x: x + 0.35, y: cmpY + 1.62, w: cmpW - 0.7, h: 0.3, fontSize: 12, color: MUTED });
    cmp[i][3].forEach(([k, v], j) => {
      T(s, k, { x: x + 0.35, y: cmpY + 2.2 + j * 0.8, w: 1, h: 0.28, fontSize: 11, bold: true, color: OCEAN });
      T(s, v, { x: x + 0.35, y: cmpY + 2.48 + j * 0.8, w: cmpW - 0.6, h: 0.45, fontSize: 14, color: INK });
    });
  }
  const ax = MX + 2 * (cmpW + 0.3), aw = CW - 2 * (cmpW + 0.3);
  card(s, ax, cmpY - 0.15, aw, cmpH + 0.3, NAVY, "compare AllBlue");
  await iconDot(s, "LuWaves", ax + 0.4, cmpY + 0.1, 0.65, CYAN, HEX.dk2, "AllBlue");
  T(s, "AllBlue", { x: ax + 0.4, y: cmpY + 0.88, w: 3, h: 0.5, fontSize: 24, bold: true, color: WHITE });
  T(s, "강사가 매번 반복하는 수업 운영", { x: ax + 0.4, y: cmpY + 1.38, w: aw - 0.8, h: 0.32, fontSize: 13, bold: true, color: CYAN });
  const allb = ["일정·서류·진도·디브리핑을\n수업 단위로 연결", "수업 직후 휴대전화로\n바로 기록", "강사 1인도 부담 없는\n월 3,900원 구독"];
  allb.forEach((t, j) => {
    s.addShape(pres.shapes.OVAL, { x: ax + 0.42, y: cmpY + 2.08 + j * 0.72, w: 0.14, h: 0.14, fill: { color: AMBER }, line: { type: "none" }, objectName: "allblue point " + j });
    T(s, t, { x: ax + 0.75, y: cmpY + 1.92 + j * 0.72, w: aw - 1.1, h: 0.62, fontSize: 14, color: WHITE, valign: "top" });
  });
  T(s, "출시 후 같은 수업을 기존 도구와 AllBlue로 준비해, 정보를 찾는 시간과 기록 작성의 편의성을 비교할 계획입니다.", { x: MX, y: 6.12, w: CW, h: 0.32, fontSize: 13, color: INK });
  T(s, "¹ SSI, MySSI App. divessi.com (2026.10.7. 확인)", { x: MX, y: 6.5, w: CW, h: 0.28, fontSize: 10, color: MUTED });

  // =============== 9. BUSINESS MODEL ===============
  s = slide("DARK", "사업", "06  사업 모델", "강사 구독 모델",
    "[40초] 비용은 강사에게만 받습니다. 월 3,900원이며 처음 3개월은 무료로 제공해 실제 수업에 적용해 볼 시간을 줍니다. 교육생은 별도 구독료 없이 함께 사용합니다. 오른쪽은 목표가 아니라 가격 계산 예시입니다. 유료 강사 300명이면 12개월 결제액은 약 1,053만 원으로, 초기에는 협업 채널로 고객 확보 비용을 줄이고 운영비를 관리해야 합니다.");
  T(s, "강사 1인 기준", { x: MX, y: 1.9, w: 5, h: 0.35, fontSize: 15, bold: true, color: CYAN });
  T(s, [{ text: "월 ", options: { fontSize: 30, color: STEEL } }, { text: "3,900", options: { fontSize: 88, color: WHITE } }, { text: "원", options: { fontSize: 30, color: STEEL } }],
    { x: MX, y: 2.25, w: 6, h: 1.5, bold: true, valign: "middle" });
  const pills = [["LuGift", "최초 3개월 무료", "실제 수업에 적용해 볼 시간"], ["LuUsers", "교육생은 무료", "강사가 초대한 교육생은 함께 사용"], ["LuMegaphone", "협업 채널 홍보", "유튜브 ‘먹보야 놀자’와 협업"]];
  for (let i = 0; i < 3; i++) {
    const y = 4.0 + i * 0.88;
    await iconDot(s, pills[i][0], MX, y, 0.62, i === 0 ? AMBER : CYAN, HEX.dk2, pills[i][1]);
    T(s, pills[i][1], { x: MX + 0.85, y: y + 0.0, w: 4.6, h: 0.34, fontSize: 17, bold: true, color: WHITE });
    T(s, pills[i][2], { x: MX + 0.85, y: y + 0.34, w: 4.6, h: 0.3, fontSize: 12, color: STEEL });
  }
  card(s, 6.7, 1.85, 6.03, 4.85, WHITE, "chart panel", { transparency: 92, noShadow: true, line: { color: STEEL, width: 0.75, transparency: 60 } });
  T(s, "가격 계산 예시 · 유료 강사 수별 12개월 결제액", { x: 7.0, y: 2.05, w: 5.5, h: 0.35, fontSize: 15, bold: true, color: WHITE });
  s.addChart(pres.charts.BAR, [{ name: "12개월 결제액(만원)", labels: ["100명", "300명", "1,000명"], values: [351, 1053, 3510] }], {
    x: 7.0, y: 2.5, w: 5.45, h: 3.35, barDir: "col", barGapWidthPct: 70,
    chartColors: [HEX.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '#,##0"만원"',
    dataLabelColor: "FFFFFF", dataLabelFontSize: 13, dataLabelFontBold: true, dataLabelFontFace: "+mn-lt",
    catAxisLabelColor: HEX.accent6, catAxisLabelFontSize: 13, catAxisLabelFontFace: "+mn-lt", catAxisLineShow: false,
    valAxisHidden: true, valAxisMaxVal: 4200, valGridLine: { style: "none" }, catGridLine: { style: "none" },
    showLegend: false, showTitle: false, objectName: "pricing example chart", altText: "유료 강사 100명 351만원, 300명 1,053만원, 1,000명 3,510만원",
  });
  T(s, "목표가 아닌 계산 예시 · 3개월 무료 후 9개월 유지 가정\n세금·수수료·운영비 차감 전, 광고 수입 제외", { x: 7.0, y: 5.95, w: 5.5, h: 0.6, fontSize: 10, color: STEEL });

  // =============== 10. ROADMAP ===============
  s = slide("LIGHT", "사업", "07  추진 계획", "출시 후 현장 검증, 그리고 확장",
    "[40초] 10월 정식 출시 후, 협업 채널을 통해 강사를 모으고 3개월 무료 체험 동안 실제 교육과정에 적용합니다. 체험이 끝나면 유료 전환과 해지 사유를 확인합니다. 활성 강사 수, 디브리핑 작성 비율, 첫 수업 이후 재사용 비율을 보겠습니다. 아직 측정 결과는 없습니다. 프리다이빙에서 검증한 뒤 다른 종목의 교육·훈련 관리와 대회 참가자의 사전교육 기록으로 확장을 제안합니다. 이는 협약이나 구현 전 단계의 제안입니다.");
  const road = [["2026.10", "정식 출시", "앱 마켓 공개, 운영 환경 점검"],
                ["출시 초기", "협업 채널 홍보", "가입부터 첫 수업까지\n흐름 확인"],
                ["무료 3개월", "현장 적용", "실제 교육과정에 쓰며 의견 수집"],
                ["체험 종료 후", "유료 전환 확인", "결제·해지 사유, 지원 비용 확인"]];
  const rW = CW / 4;
  s.addShape(pres.shapes.LINE, { x: MX + 0.3, y: 2.12, w: CW - rW + 0.0, h: 0, line: { color: STEEL, width: 2 }, objectName: "roadmap line" });
  for (let i = 0; i < 4; i++) {
    const x = MX + i * rW;
    s.addShape(pres.shapes.OVAL, { x: x + 0.12, y: 1.94, w: 0.36, h: 0.36, fill: { color: i === 0 ? AMBER : OCEAN }, line: { color: WHITE, width: 3 }, objectName: "roadmap node " + i });
    T(s, road[i][0], { x, y: 2.48, w: rW - 0.3, h: 0.3, fontSize: 12, bold: true, color: i === 0 ? AMBER : OCEAN });
    T(s, road[i][1], { x, y: 2.8, w: rW - 0.3, h: 0.42, fontSize: 19, bold: true, color: INK });
    T(s, road[i][2], { x, y: 3.25, w: rW - 0.35, h: 0.6, fontSize: 13, color: MUTED });
  }
  const boxW = (CW - 0.3) / 2;
  const boxes = [["LuTarget", "출시 후 확인할 지표", ["활성 강사 수 — 기간 내 수업을 운영한 강사", "디브리핑 작성 비율 — 완료 수업 대비", "재사용 비율 — 첫 수업 이후 다시 사용"], "측정 결과는 아직 없으며, 초기 사용부터 기록합니다."],
                 ["LuRocket", "스포츠 교육·대회 운영으로 확장 제안", ["여러 강사가 함께 운영하는 소규모 교육업체", "다른 종목의 교육·훈련 진도 관리", "대회 참가자의 훈련·사전교육 기록 관리"], "공모전 연계 실증 제안이며, 협약·구현 전 단계입니다."]];
  for (let i = 0; i < 2; i++) {
    const x = MX + i * (boxW + 0.3), y = 4.15;
    card(s, x, y, boxW, 2.55, WHITE, "roadmap box " + (i + 1));
    await iconDot(s, boxes[i][0], x + 0.3, y + 0.28, 0.6, i === 1 ? OCEAN : ICE, i === 1 ? "FFFFFF" : HEX.accent2, boxes[i][1]);
    T(s, boxes[i][1], { x: x + 1.05, y: y + 0.34, w: boxW - 1.3, h: 0.45, fontSize: 17, bold: true, color: INK, valign: "middle" });
    T(s, boxes[i][2].map((t, j) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: j < 2 } })), { x: x + 0.3, y: y + 1.0, w: boxW - 0.55, h: 1.05, fontSize: 14, color: INK, paraSpaceAfter: 3 });
    T(s, boxes[i][3], { x: x + 0.3, y: y + 2.1, w: boxW - 0.55, h: 0.3, fontSize: 10, color: MUTED });
  }

  // =============== 11. TEAM ===============
  pres.addSection({ title: "팀과 마무리" });
  s = slide("DARK", "팀과 마무리", "08  팀", "직접 다이빙하는 개발자가 만듭니다",
    "[30초] 저는 개발 14년차이고 프리다이빙은 3년째, AIDA Level 2 자격을 보유하고 있습니다. 내부 인력은 저 한 명으로 개발과 운영을 맡고, AIDA Instructor 자격을 가진 협업자가 현장 의견을 주며, 유튜브 먹보야 놀자와 홍보를 준비하고 있습니다. 문제를 직접 겪는 개발자로서 다음 수업에도 쓰이는 제품을 만들겠습니다.");
  const big = [["14", "년차", "개발자", "기획·개발·운영을 직접 수행"], ["3", "년차", "프리다이버", "AIDA Level 2 자격 보유"]];
  for (let i = 0; i < 2; i++) {
    const x = MX + i * 3.1;
    T(s, [{ text: big[i][0], options: { fontSize: 88, color: CYAN } }, { text: " " + big[i][1], options: { fontSize: 24, color: WHITE } }], { x, y: 1.85, w: 3.0, h: 1.6, bold: true, valign: "bottom" });
    T(s, big[i][2], { x, y: 3.55, w: 2.9, h: 0.45, fontSize: 22, bold: true, color: WHITE });
    T(s, big[i][3], { x, y: 4.05, w: 2.9, h: 0.6, fontSize: 14, color: STEEL });
  }
  T(s, "남상현  ·  럼바우 대표", { x: MX, y: 5.35, w: 5.8, h: 0.4, fontSize: 18, bold: true, color: WHITE });
  T(s, "개인사업자 · 2025년 4월 개업 · 정보통신업(컴퓨터 프로그래밍 서비스업)", { x: MX, y: 5.8, w: 5.9, h: 0.6, fontSize: 12, color: STEEL });
  const team = [["LuCode", "대표 · 개발 및 운영", "남상현 (1인)", "앱 개발, 서버 운영, 고객 대응"],
                ["LuBadgeCheck", "현장 자문", "AIDA Instructor 협업자", "강사 관점의 기능 의견 제공"],
                ["LuYoutube", "홍보 협업", "유튜브 ‘먹보야 놀자’", "강사의 실제 사용 모습을 담은 콘텐츠"]];
  for (let i = 0; i < 3; i++) {
    const y = 1.9 + i * 1.6;
    card(s, 6.9, y, 5.83, 1.35, WHITE, "team card " + (i + 1), { transparency: 90, noShadow: true, line: { color: STEEL, width: 0.75, transparency: 60 } });
    await iconDot(s, team[i][0], 7.15, y + 0.3, 0.75, i === 0 ? AMBER : CYAN, HEX.dk2, team[i][1]);
    T(s, team[i][1], { x: 8.15, y: y + 0.18, w: 4.4, h: 0.28, fontSize: 11, bold: true, color: CYAN });
    T(s, team[i][2], { x: 8.15, y: y + 0.45, w: 4.4, h: 0.4, fontSize: 18, bold: true, color: WHITE });
    T(s, team[i][3], { x: 8.15, y: y + 0.88, w: 4.4, h: 0.3, fontSize: 13, color: ICE });
  }

  // =============== 12. CLOSING ===============
  s = pres.addSlide({ masterName: "COVER", sectionTitle: "팀과 마무리" });
  s.addNotes("[10초] AllBlue는 수업이 끝난 뒤에도 기록이 이어지는 프리다이빙 교육을 만들겠습니다. 감사합니다.");
  T(s, "AllBlue", { x: MX, y: 1.6, w: 7, h: 0.6, fontSize: 22, bold: true, color: CYAN });
  T(s, [{ text: "수업이 끝나도,", options: { breakLine: true } }, { text: "기록은 이어집니다", options: {} }], { x: MX, y: 2.3, w: 7.3, h: 1.9, fontSize: 48, bold: true, color: WHITE });
  T(s, "프리다이빙 강사와 교육생을 위한 교육 운영 앱\n2026년 10월 정식 출시 예정", { x: MX, y: 4.3, w: 7, h: 0.75, fontSize: 15, color: ICE });
  T(s, "감사합니다", { x: MX, y: 5.6, w: 5, h: 0.6, fontSize: 28, bold: true, color: WHITE });
  T(s, "럼바우  |  대표 남상현", { x: MX, y: 6.25, w: 5, h: 0.35, fontSize: 14, color: STEEL });
  phone(s, "10_feature_8.png", 8.0, 1.5, 4.9, { rotate: -7 });
  phone(s, "09_feature_7.png", 10.15, 1.0, 5.6, { rotate: 5, shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 18, offset: 6, angle: 90 } });

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
