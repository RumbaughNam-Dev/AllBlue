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
pres.title = "AllBlue IR - Seed";
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
  { text: { text: "AllBlue  ·  Seed IR  ·  2026.10", options: { x: MX, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: dark ? STEEL : MUTED, margin: 0 } } },
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
  s.addNotes("안녕하세요, 럼바우 대표 남상현입니다. AllBlue는 프리다이빙 강사의 수업 일정, 교육생 진도, 수업 후 피드백을 하나로 연결하는 앱입니다. 현재 정식 출시 전이며 2026년 10월 안에 출시할 예정입니다.");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 0.9, w: 2.55, h: 0.42, rectRadius: 0.21, fill: { color: CYAN, transparency: 82 }, line: { color: CYAN, width: 1 }, objectName: "category chip" });
  T(s, "SEED IR  ·  2026.10", { x: MX, y: 0.9, w: 2.55, h: 0.42, fontSize: 12, bold: true, color: CYAN, align: "center", valign: "middle" });
  T(s, "AllBlue", { x: MX, y: 1.75, w: 7, h: 1.4, fontSize: 80, bold: true, color: WHITE, valign: "middle" });
  T(s, [
    { text: "프리다이빙 교육,", options: { breakLine: true } },
    { text: "수업 다음까지 ", options: {} },
    { text: "이어지게", options: { color: CYAN } },
  ], { x: MX, y: 3.3, w: 7, h: 1.5, fontSize: 36, bold: true, color: WHITE });
  T(s, "일정 · 교육생 진도 · 수업 피드백을 하나로 잇는\n강사용 교육 운영 앱", { x: MX, y: 4.9, w: 6.6, h: 0.75, fontSize: 16, color: ICE });
  T(s, [
    { text: "Seed 1억 원 투자 제안  ·  디유파트너스 X 서울창업허브 공덕", options: { breakLine: true, color: STEEL } },
    { text: "럼바우  |  대표 남상현", options: { bold: true, color: WHITE } },
  ], { x: MX, y: 6.0, w: 6.6, h: 0.8, fontSize: 14 });
  // fanned phones
  phone(s, "06_feature_4.png", 7.35, 1.55, 4.9, { rotate: -9 });
  phone(s, "03_feature_1.png", 10.45, 1.55, 4.9, { rotate: 9 });
  phone(s, "05_feature_3.png", 8.85, 1.0, 5.6, { shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 18, offset: 6, angle: 90 } });

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

  // =============== PRODUCT ===============
  pres.addSection({ title: "제품" });
  s = slide("LIGHT", "제품", "03  제품", "수업 전부터 수업 후까지, 휴대전화 하나로",
    "실제 앱 화면입니다. 월간 캘린더와 일정, 교육생 서류 현황, 과정별 요건 체크, 수업 직후 디브리핑까지 한 흐름으로 이어집니다. 개발은 완료됐고 2026년 10월 정식 출시합니다.");
  const prod = [["10_feature_8.png", "캘린더"], ["07_feature_5.png", "서류 현황"], ["05_feature_3.png", "과정별 요건"], ["06_feature_4.png", "디브리핑"]];
  for (let i = 0; i < 4; i++) {
    const x = MX + 0.2 + i * 3.05;
    phone(s, prod[i][0], x + 0.25, 1.75, 4.3);
    numDot(s, i + 1, x, 1.6, 0.5, i === 3 ? AMBER : OCEAN, WHITE, 15);
    T(s, prod[i][1], { x: x + 0.25, y: 6.15, w: 2.05, h: 0.4, fontSize: 16, bold: true, color: INK, align: "center" });
  }

  // =============== MARKET ===============
  pres.addSection({ title: "사업" });
  s = slide("DARK", "사업", "04  시장", "프리다이빙에서 시작해 소규모 스포츠 강습으로",
    "AIDA는 2024년 한 해 전 세계에서 6만 건 이상의 자격을 발급했습니다. 영어권 다이버 설문에서 AIDA, SSI, PADI가 주요 교육단체로 꼽힙니다. 국내 강사 수는 공식 통계가 없어 출시 후 협업 채널을 통해 직접 확인하겠습니다. 프리다이빙에서 검증한 뒤 같은 구조의 소규모 스포츠 강습으로 넓힐 계획입니다.");
  T(s, [{ text: "60,000+", options: { fontSize: 72, color: CYAN } }], { x: MX, y: 1.8, w: 6, h: 1.3, bold: true, valign: "middle" });
  T(s, "AIDA가 2024년 전 세계에서 발급한 자격 수\n(교육생·강사 합계) ¹", { x: MX, y: 3.05, w: 5.8, h: 0.75, fontSize: 15, color: ICE });
  T(s, "주요 교육단체 비중 (영어권 다이버 설문) ²", { x: MX, y: 4.0, w: 5.8, h: 0.35, fontSize: 14, bold: true, color: WHITE });
  const share = [["AIDA", 33.4], ["SSI", 23.1], ["PADI", 17.9]];
  share.forEach(([k, v], i) => {
    const y = 4.5 + i * 0.55;
    T(s, k, { x: MX, y, w: 0.9, h: 0.4, fontSize: 14, bold: true, color: ICE, valign: "middle" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX + 1.0, y: y + 0.08, w: 4.0 * v / 33.4, h: 0.26, rectRadius: 0.13, fill: { color: i === 0 ? CYAN : STEEL }, line: { type: "none" }, objectName: "share bar " + k });
    T(s, v + "%", { x: MX + 1.15 + 4.0 * v / 33.4, y, w: 0.9, h: 0.4, fontSize: 13, color: WHITE, valign: "middle" });
  });
  const exp = [["LuWaves", "1단계 · 프리다이빙", "AIDA 과정 요건과 서류 흐름을 반영한 강사용 도구"],
               ["LuAnchor", "2단계 · 수중·해양 레저", "과정·서류 구조가 비슷한 스쿠버 등으로 확장"],
               ["LuUsers", "3단계 · 소규모 스포츠 강습", "진도·피드백이 필요한 1인 강사 종목 검토"]];
  for (let i = 0; i < 3; i++) {
    const y = 1.85 + i * 1.45;
    card(s, 6.9, y, 5.83, 1.2, WHITE, "expand card " + i, { transparency: 90, noShadow: true, line: { color: STEEL, width: 0.75, transparency: 60 } });
    await iconDot(s, exp[i][0], 7.15, y + 0.25, 0.7, i === 0 ? AMBER : CYAN, HEX.dk2, exp[i][1]);
    T(s, exp[i][1], { x: 8.1, y: y + 0.18, w: 4.5, h: 0.38, fontSize: 17, bold: true, color: WHITE });
    T(s, exp[i][2], { x: 8.1, y: y + 0.58, w: 4.5, h: 0.5, fontSize: 13, color: ICE });
  }
  T(s, "국내 프리다이빙 강사 수는 공식 통계가 없어, 출시 후 협업 채널 유입과 강사 인터뷰로 직접 측정합니다. 2·3단계는 검증 전 확장 가설입니다.", { x: 6.9, y: 6.2, w: 5.83, h: 0.5, fontSize: 10, color: STEEL });
  T(s, "¹ AIDA International, 2024 연말 리뷰  ² Deeper Blue 독자 설문(2025, 영어권 응답 중심)", { x: MX, y: 6.4, w: 6, h: 0.3, fontSize: 10, color: STEEL });

  // =============== 9. BUSINESS MODEL ===============
  s = slide("DARK", "사업", "05  사업 모델", "강사 구독 모델",
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

  // =============== TRACTION / STATUS ===============
  s = slide("LIGHT", "사업", "06  현황", "개발 완료, 10월 출시 — 운영 자금은 자체 매출로",
    "AllBlue는 개발을 마치고 운영 환경에서 테스트 중이며 10월 정식 출시합니다. 아직 AllBlue 매출은 없습니다. 럼바우는 다른 소프트웨어 개발 프로젝트로 연 8,844만 원 매출을 내고 있어 출시 초기 운영 자금을 스스로 감당합니다. 이 매출은 AllBlue 실적과 구분합니다.");
  const st = [["LuSmartphone", "제품", "개발 완료", "일정·초대·서류·진도·\n디브리핑 기능 구현,\n운영 환경 테스트"],
              ["LuRocket", "출시", "2026년 10월", "App Store ·\nGoogle Play 정식 출시"],
              ["LuMegaphone", "채널", "유튜브 협업", "‘먹보야 놀자’ 채널과\n강사 대상 홍보 준비"],
              ["LuWallet", "운영 자금", "연 8,844만 원", "럼바우 외주 개발 매출\n(AllBlue 매출 아님)"]];
  const tsW = (CW - 3 * 0.3) / 4;
  for (let i = 0; i < 4; i++) {
    const x = MX + i * (tsW + 0.3), y = 1.85;
    card(s, x, y, tsW, 3.2, WHITE, "status card " + i);
    await iconDot(s, st[i][0], x + 0.3, y + 0.3, 0.7, i === 1 ? AMBER : ICE, i === 1 ? HEX.dk2 : HEX.accent2, st[i][1]);
    T(s, st[i][1], { x: x + 0.3, y: y + 1.2, w: tsW - 0.6, h: 0.3, fontSize: 12, bold: true, color: MUTED });
    T(s, st[i][2], { x: x + 0.3, y: y + 1.5, w: tsW - 0.5, h: 0.5, fontSize: 21, bold: true, color: INK });
    T(s, st[i][3], { x: x + 0.3, y: y + 2.1, w: tsW - 0.55, h: 0.95, fontSize: 13, color: MUTED });
  }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 5.4, w: CW, h: 1.2, rectRadius: 0.14, fill: { color: NAVY }, line: { type: "none" }, objectName: "status strip" });
  T(s, [{ text: "솔직한 현재 지표  ", options: { bold: true, color: CYAN } },
        { text: "AllBlue 매출 0원 · 테스트 사용자(강사·교육생) 5명 이내 · 정부지원·투자 이력 없음", options: { color: WHITE } }],
    { x: MX + 0.4, y: 5.4, w: CW - 0.8, h: 0.6, fontSize: 15, valign: "middle" });
  T(s, "출시 후 확인할 지표: 활성 강사 수 · 디브리핑 작성 비율 · 첫 수업 이후 재사용 비율 · 무료 체험 후 유료 전환율", { x: MX + 0.4, y: 5.95, w: CW - 0.8, h: 0.5, fontSize: 13, color: STEEL, valign: "middle" });


  // =============== 8. DIFFERENTIATION ===============
  
  s = slide("LIGHT", "사업", "07  경쟁", "교육 콘텐츠가 아닌, 강사의 수업 운영에 집중",
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

  // =============== 10. ROADMAP ===============
  s = slide("LIGHT", "사업", "08  성장 계획", "출시 후 현장 검증, 그리고 확장",
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
                 ["LuRocket", "확장 방향 (검증 후)", ["여러 강사가 함께 운영하는 소규모 교육업체", "다른 종목의 교육·훈련 진도 관리", "대회 참가자의 훈련·사전교육 기록 관리"], "프리다이빙 검증 이후 검토할 확장 가설입니다."]];
  for (let i = 0; i < 2; i++) {
    const x = MX + i * (boxW + 0.3), y = 4.15;
    card(s, x, y, boxW, 2.55, WHITE, "roadmap box " + (i + 1));
    await iconDot(s, boxes[i][0], x + 0.3, y + 0.28, 0.6, i === 1 ? OCEAN : ICE, i === 1 ? "FFFFFF" : HEX.accent2, boxes[i][1]);
    T(s, boxes[i][1], { x: x + 1.05, y: y + 0.34, w: boxW - 1.3, h: 0.45, fontSize: 17, bold: true, color: INK, valign: "middle" });
    T(s, boxes[i][2].map((t, j) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: j < 2 } })), { x: x + 0.3, y: y + 1.0, w: boxW - 0.55, h: 1.05, fontSize: 14, color: INK, paraSpaceAfter: 3 });
    T(s, boxes[i][3], { x: x + 0.3, y: y + 2.1, w: boxW - 0.55, h: 0.3, fontSize: 10, color: MUTED });
  }

  // =============== 11. TEAM ===============
  pres.addSection({ title: "팀과 투자" });
  s = slide("DARK", "팀과 투자", "09  팀", "직접 다이빙하는 개발자가 만듭니다",
    "[30초] 저는 개발 14년차이고 프리다이빙은 3년째, AIDA Level 2 자격을 보유하고 있습니다. 내부 인력은 저 한 명으로 개발과 운영을 맡고, AIDA Instructor 자격을 가진 협업자가 현장 의견을 주며, 유튜브 먹보야 놀자와 홍보를 준비하고 있습니다. 문제를 직접 겪는 개발자로서 다음 수업에도 쓰이는 제품을 만들겠습니다.");
  const big = [["14", "년차", "개발자", "기획·개발·운영을 직접 수행"], ["3", "년차", "프리다이버", "AIDA Level 2 · Level 3 진행 중"]];
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

  // =============== ASK ===============
  s = slide("DARK", "팀과 투자", "10  투자 제안", "Seed 1억 원으로 출시 후 12개월 검증",
    "Seed 1억 원을 제안합니다. 투자가 확정되면 법인으로 전환해 투자를 받겠습니다. 자금은 강사 고객 확보 마케팅, 기능 고도화와 개발 인력, 개인정보 보안과 법률, 운영에 씁니다. 12개월 동안 활성 강사와 유료 전환율을 검증하고, 그 결과로 후속 투자와 다른 종목 확장을 판단하겠습니다.");
  T(s, "투자 희망", { x: MX, y: 1.9, w: 5, h: 0.35, fontSize: 15, bold: true, color: CYAN });
  T(s, [{ text: "1", options: { fontSize: 96, color: WHITE } }, { text: " 억 원", options: { fontSize: 30, color: STEEL } }], { x: MX, y: 2.2, w: 5.5, h: 1.6, bold: true, valign: "middle" });
  T(s, "Seed  ·  투자 확정 시 법인 전환 후 집행", { x: MX, y: 3.85, w: 5.6, h: 0.4, fontSize: 16, color: ICE });
  const mil = [["0–3개월", "출시 · 협업 채널 홍보 · 무료 체험 강사 모집"], ["4–6개월", "유료 전환 · 사용 데이터로 기능 개선"], ["7–12개월", "유료 강사 확대 · 수중 레저로 확장 검토"]];
  mil.forEach(([k, v], i) => {
    const y = 4.55 + i * 0.68;
    numDot(s, i + 1, MX, y, 0.48, i === 0 ? AMBER : CYAN, HEX.dk2, 13);
    T(s, k, { x: MX + 0.7, y: y - 0.02, w: 1.3, h: 0.5, fontSize: 14, bold: true, color: CYAN, valign: "middle" });
    T(s, v, { x: MX + 2.0, y: y - 0.02, w: 4.2, h: 0.5, fontSize: 13, color: WHITE, valign: "middle" });
  });
  card(s, 6.9, 1.85, 5.83, 4.85, WHITE, "use of funds panel", { transparency: 92, noShadow: true, line: { color: STEEL, width: 0.75, transparency: 60 } });
  T(s, "자금 활용 계획 (안)", { x: 7.2, y: 2.05, w: 5.3, h: 0.35, fontSize: 15, bold: true, color: WHITE });
  s.addChart(pres.charts.DOUGHNUT, [{ name: "자금 활용", labels: ["강사 확보 마케팅", "기능 고도화·개발", "보안·법률·인프라", "운영"], values: [40, 35, 15, 10] }], {
    x: 7.1, y: 2.5, w: 2.9, h: 2.9, holeSize: 58, chartColors: [HEX.accent1, HEX.accent5, HEX.accent3, HEX.accent6],
    showLegend: false, showValue: false, showPercent: false, showTitle: false, dataBorder: { pt: 1, color: "0A2540" },
    objectName: "use of funds chart", altText: "마케팅 40%, 개발 35%, 보안·법률·인프라 15%, 운영 10%",
  });
  const uses = [["강사 확보 마케팅", "40%", "4,000만", "accent1"], ["기능 고도화·개발", "35%", "3,500만", "accent5"], ["보안·법률·인프라", "15%", "1,500만", "accent3"], ["운영", "10%", "1,000만", "accent6"]];
  uses.forEach(([k, p, a, c], i) => {
    const y = 2.75 + i * 0.62;
    s.addShape(pres.shapes.OVAL, { x: 10.2, y: y + 0.14, w: 0.16, h: 0.16, fill: { color: C[c] }, line: { type: "none" }, objectName: "legend " + i });
    T(s, k, { x: 10.45, y, w: 1.7, h: 0.45, fontSize: 12, color: WHITE, valign: "middle" });
    T(s, p, { x: 12.0, y, w: 0.6, h: 0.45, fontSize: 12, bold: true, color: WHITE, valign: "middle", align: "right" });
  });
  T(s, "비율은 제안 단계의 계획이며 투자 협의 과정에서 조정합니다.", { x: 7.2, y: 5.65, w: 5.3, h: 0.6, fontSize: 11, color: STEEL });

  // =============== 12. CLOSING ===============
  s = pres.addSlide({ masterName: "COVER", sectionTitle: "팀과 투자" });
  s.addNotes("[10초] AllBlue는 수업이 끝난 뒤에도 기록이 이어지는 프리다이빙 교육을 만들겠습니다. 감사합니다.");
  T(s, "AllBlue", { x: MX, y: 1.6, w: 7, h: 0.6, fontSize: 22, bold: true, color: CYAN });
  T(s, [{ text: "수업이 끝나도,", options: { breakLine: true } }, { text: "기록은 이어집니다", options: {} }], { x: MX, y: 2.3, w: 7.3, h: 1.9, fontSize: 48, bold: true, color: WHITE });
  T(s, "프리다이빙 강사와 교육생을 위한 교육 운영 앱\n2026년 10월 정식 출시 예정", { x: MX, y: 4.3, w: 7, h: 0.75, fontSize: 15, color: ICE });
  T(s, "rumbau.studio@gmail.com", { x: MX, y: 5.6, w: 5, h: 0.6, fontSize: 22, bold: true, color: WHITE });
  T(s, "럼바우  |  대표 남상현", { x: MX, y: 6.25, w: 5, h: 0.35, fontSize: 14, color: STEEL });
  phone(s, "10_feature_8.png", 8.0, 1.5, 4.9, { rotate: -7 });
  phone(s, "09_feature_7.png", 10.15, 1.0, 5.6, { rotate: 5, shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 18, offset: 6, angle: 90 } });

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
