/* 운동 사전(표준 종목) + 이름 정규화 + 추천 루틴 프리셋
   브라우저(index.html)와 Node(tools/build-tips.js) 양쪽에서 쓴다. 외부 의존성 없음. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CATALOG = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PARTS = ["가슴", "등", "어깨", "팔", "하체", "코어", "유산소", "기타"];
  const EQUIPS = ["바벨", "덤벨", "이지바", "머신", "케이블", "맨몸", "밴드", "유산소", "기타"];
  // 장비별 점진 과부하 단위(kg). 바벨·이지바는 양쪽에 2.5kg 원판 하나씩 = 5kg가 최소. 머신·케이블은 핀 스택 5kg. 덤벨은 한 손 기준 1kg.
  const STEP = { 바벨: 5, 이지바: 5, 덤벨: 1, 머신: 5, 케이블: 5, 맨몸: 0, 밴드: 0, 유산소: 0, 기타: 5 };
  // 기본 종목 목록에 들어가지 않는 '사전 전용' 종목 (필요할 때 종목 선택 시트의 '사전에서 추가'로 고른다)
  const EXTRA_ONLY = ["hip_thrust", "bulgarian_split_squat", "cable_crossover", "hanging_leg_raise", "cable_crunch", "side_plank"];

  // key, name, part, equip, unit, sub(세부), aliases, desc(기본 설명: PT 메모가 없을 때 보여줌)
  const EX = [
    // ---------- 가슴 ----------
    { key: "bench_press", name: "벤치 프레스", part: "가슴", equip: "바벨", unit: "wr",
      aliases: ["벤치프레스", "바벨 벤치 프레스", "바벨 벤치프레스"],
      desc: "견갑을 모아 벤치에 고정하고 발로 바닥을 밀어 몸을 단단히 만든 뒤, 바를 가슴 중앙(명치 위)으로 내렸다가 가슴 힘으로 밀어 올려 주세요. 손목은 세우고 팔꿈치는 몸통과 45도 정도로 유지합니다." },
    { key: "incline_db_press", name: "인클라인 덤벨 체스트 프레스", part: "가슴", equip: "덤벨", unit: "wr",
      aliases: ["인클라인 덤벨 프레스", "인클라인 덤벨 체스트프레스"],
      desc: "벤치를 30~45도로 세우고 가슴을 들어 올린 상태에서 덤벨을 윗가슴 라인으로 내렸다가, 위로 모으듯 밀어 윗가슴을 짜 주세요." },
    { key: "db_chest_press", name: "덤벨 체스트 프레스", part: "가슴", equip: "덤벨", unit: "wr",
      aliases: ["덤벨 프레스", "플랫 덤벨 프레스"],
      desc: "견갑을 모은 채 덤벨을 가슴 옆까지 내려 가슴이 늘어나는 걸 느끼고, 올릴 때 두 덤벨이 가까워지도록 모아 밀어 주세요. 바닥에 붙인 발로 지지합니다." },
    { key: "machine_chest_press", name: "머신 체스트 프레스", part: "가슴", equip: "머신", unit: "wr",
      aliases: ["체스트 프레스", "체스트프레스 머신"],
      desc: "손잡이가 가슴 중간 높이에 오도록 시트를 맞추고, 어깨를 내리고 가슴을 편 상태에서 팔꿈치를 뒤로 뺐다가 가슴 힘으로 밀어 주세요. 끝에서 팔꿈치를 완전히 잠그지 않습니다." },
    { key: "pec_deck", name: "펙 덱 플라이", part: "가슴", equip: "머신", unit: "wr",
      aliases: ["펙덱 플라이", "펙덱플라이", "펙 덱 플라이(가슴)", "펙 덱 플라이 (가슴)", "체스트 플라이"],
      desc: "어깨가 앞으로 말리지 않게 가슴을 펴고 팔꿈치를 살짝 굽힌 채, 팔을 안으로 모으며 가슴 안쪽을 짜고 돌아올 때는 가슴이 늘어나는 범위까지만 천천히 열어 주세요." },
    { key: "assisted_dips", name: "어시스트 딥스", part: "가슴", equip: "머신", unit: "wr",
      aliases: ["어시스트 딥", "보조 딥스"],
      desc: "무릎을 패드에 올리고(무게가 클수록 보조가 큼) 상체를 살짝 앞으로 기울여 가슴을 쓰고, 어깨가 으쓱 올라가지 않게 내렸다가 팔 뒤쪽과 가슴 힘으로 밀어 올려 주세요." },
    { key: "dips", name: "딥스", part: "가슴", equip: "맨몸", unit: "reps", sub: "삼두",
      aliases: ["딥", "평행봉 딥스"],
      desc: "어깨가 으쓱 올라가지 않게 내리고, 팔꿈치를 뒤로 접으며 내려갔다가 팔 뒤쪽(삼두) 힘으로 밀어 올려 주세요. 상체를 세우면 삼두, 숙이면 가슴 비중이 커집니다." },
    { key: "pushup", name: "푸시업", part: "가슴", equip: "맨몸", unit: "reps",
      aliases: ["푸쉬업", "팔굽혀펴기"],
      desc: "손은 어깨보다 조금 넓게, 몸은 머리부터 발끝까지 일직선을 유지하고 가슴이 바닥에 닿기 직전까지 내렸다가 밀어 올려 주세요. 허리가 꺾이지 않게 배에 힘을 줍니다." },

    // ---------- 등 ----------
    { key: "deadlift", name: "데드리프트", part: "등", equip: "바벨", unit: "wr",
      aliases: ["컨벤셔널 데드리프트", "데드"],
      desc: "복부에 힘을 주고 바벨을 정강이에 붙인 채, 가슴을 들고 등을 곧게 유지하며 발바닥으로 바닥을 밀어 엉덩이와 허벅지 뒤쪽 힘으로 일어나 주세요. 내릴 때도 바를 몸에서 떨어뜨리지 않습니다." },
    { key: "rdl", name: "루마니안 데드리프트", part: "등", equip: "바벨", unit: "wr", sub: "햄스트링",
      aliases: ["루마니안데드리프트", "RDL", "루마니안 데드"],
      desc: "무릎을 살짝 굽힌 채 고정하고 엉덩이를 뒤로 보내며 바를 허벅지를 따라 내려, 허벅지 뒤쪽이 당기는 지점에서 엉덩이 힘으로 돌아와 주세요. 허리는 끝까지 곧게 유지합니다." },
    { key: "dead_hang", name: "행 데드", part: "등", equip: "맨몸", unit: "reps",
      aliases: ["행잉", "데드 행", "매달리기"],
      desc: "바에 매달려 어깨를 귀에서 멀어지게 끌어내린 상태로 버텨 주세요. 등 윗부분과 광배가 몸을 잡고 있는 느낌을 유지합니다." },
    { key: "pullup", name: "풀업", part: "등", equip: "맨몸", unit: "reps",
      aliases: ["풀 업", "턱걸이"],
      desc: "어깨가 귀 쪽으로 올라가지 않도록 먼저 견갑을 내리고, 팔꿈치를 아래·옆구리로 당겨 가슴을 바 쪽으로 올려 주세요. 내려올 때는 천천히 버팁니다." },
    { key: "assisted_pullup", name: "어시스트 풀업", part: "등", equip: "머신", unit: "wr",
      aliases: ["어시스트 풀업(등)", "어시스트 풀업 (등)", "보조 풀업"],
      desc: "무릎 패드에 올라 보조를 받되(무게가 클수록 쉬움), 어깨를 아래로 끌어내린 뒤 팔꿈치를 옆구리로 당겨 등을 사용해 주세요. 반동 없이 내려올 때도 천천히 버팁니다." },
    { key: "band_pullup", name: "밴드 풀업", part: "등", equip: "밴드", unit: "reps",
      aliases: ["밴드 어시스트 풀업", "밴드풀업"],
      desc: "밴드에 발이나 무릎을 걸고, 어깨를 아래로 끌어내린 뒤 팔꿈치를 옆구리로 당기며 가슴을 바 쪽으로 올려 등 전체를 사용해 주세요." },
    { key: "jump_pullup", name: "점프 풀업", part: "등", equip: "맨몸", unit: "reps",
      aliases: ["점핑 풀업", "점프풀업"],
      desc: "가볍게 점프해 몸을 끌어올린 뒤 맨 위에서 잠깐 버티고, 내려올 때 최대한 천천히 버티며 등 근육을 느껴 주세요." },
    { key: "lat_pulldown", name: "랫 풀다운", part: "등", equip: "케이블", unit: "wr",
      aliases: ["랫풀다운", "랫 풀다운", "렛 풀 다운", "렛풀다운", "렛 풀다운"],
      desc: "어깨를 내린 상태에서 가슴을 펴고 팔꿈치를 몸통 쪽으로 당겨 바를 쇄골 근처까지 내려 등 옆쪽에 힘을 주세요. 올릴 때는 어깨가 딸려 올라가지 않게 천천히 보냅니다." },
    { key: "lat_pulldown_under", name: "랫 풀다운 언더그립", part: "등", equip: "케이블", unit: "wr",
      aliases: ["렛 풀 다운 언더그립(등)", "렛 풀 다운 언더그립", "랫 풀 다운 언더그립 (등)", "언더그립 랫풀다운", "언더그립 랫 풀 다운"],
      desc: "손바닥이 나를 보게 어깨너비로 잡고, 팔꿈치를 몸 옆으로 붙여 아래로 당겨 광배 아래쪽에 힘을 주세요. 이두로만 당기지 않도록 가슴을 들고 어깨를 내립니다." },
    { key: "seated_row", name: "롱 풀", part: "등", equip: "케이블", unit: "wr",
      aliases: ["머신 롱풀", "롱풀", "시티드 케이블 로우", "시티드 로우", "케이블 로우"],
      desc: "상체를 과하게 젖히지 않고 가슴을 편 채 팔꿈치를 뒤로 당겨 손잡이를 배 쪽으로 붙이며 등 가운데를 모아 주세요. 돌아갈 때 어깨가 앞으로 말리지 않게 합니다." },
    { key: "straight_arm_pulldown", name: "암 풀다운", part: "등", equip: "케이블", unit: "wr",
      aliases: ["암풀다운", "스트레이트 암 풀다운", "스트레이트암 풀다운"],
      desc: "팔꿈치를 살짝 굽힌 각도로 고정하고, 겨드랑이를 닫는 느낌으로 손잡이를 허벅지까지 내려 광배근에 힘을 주세요. 올라갈 때 어깨가 으쓱하지 않게 합니다." },
    { key: "barbell_row", name: "바벨 로우", part: "등", equip: "바벨", unit: "wr",
      aliases: ["바벨로우", "벤트오버 바벨 로우"],
      desc: "상체 각도를 고정하고 바벨을 배꼽 쪽으로 당기며 등 가운데에 힘을 주세요. 팔꿈치가 몸에서 너무 벌어지지 않게 하고, 내릴 때 등이 둥글어지지 않도록 합니다." },
    { key: "one_arm_db_row", name: "원 암 덤벨 로우", part: "등", equip: "덤벨", unit: "wr",
      aliases: ["덤벨 로우", "원암 덤벨 로우", "원 암 로우"],
      desc: "한 손과 무릎을 벤치에 대고 몸통이 돌아가지 않도록 고정한 뒤, 팔꿈치를 골반 쪽으로 당겨 등 옆쪽에 힘을 주세요. 내릴 때 어깨가 딸려 내려가지 않게 합니다." },
    { key: "two_arm_db_row", name: "투 암 덤벨 로우", part: "등", equip: "덤벨", unit: "wr",
      aliases: ["투암 덤벨 로우", "덤벨 벤트오버 로우"],
      desc: "엉덩이를 뒤로 빼고 상체를 숙여 고정한 채, 양쪽 팔꿈치를 동시에 뒤로 당겨 등 가운데를 모아 주세요. 허리가 둥글어지지 않게 배에 힘을 줍니다." },
    { key: "db_seal_row", name: "투 암 덤벨 씰 로우", part: "등", equip: "덤벨", unit: "wr",
      aliases: ["덤벨 씰로우", "씰 로우", "씰로우", "체스트 서포티드 로우"],
      desc: "가슴을 벤치에 완전히 지지해 반동을 없애고, 양쪽 팔꿈치를 뒤로 당겨 등에 힘을 느껴 주세요. 내릴 때 견갑이 벌어지는 것까지 느끼면 가동 범위가 좋아집니다." },
    { key: "cable_high_row", name: "케이블 투 암 하이 로우", part: "등", equip: "케이블", unit: "wr",
      aliases: ["케이블 하이로우", "하이 로우", "케이블 하이 로우"],
      desc: "어깨를 으쓱하지 않고 높은 위치의 손잡이를 양팔로 몸 쪽으로 당겨, 팔꿈치가 몸 뒤로 지나가며 등 상부가 모이는 걸 느껴 주세요." },
    { key: "shrug", name: "슈러그", part: "등", equip: "덤벨", unit: "reps", sub: "승모",
      aliases: ["덤벨 슈러그", "바벨 슈러그"],
      desc: "어깨를 귀 쪽으로 곧장 위로 들어 올렸다가 천천히 내려 승모근을 사용해 주세요. 어깨를 돌리지 않고 수직으로만 움직입니다." },

    // ---------- 어깨 ----------
    { key: "barbell_ohp", name: "바벨 오버헤드 프레스", part: "어깨", equip: "바벨", unit: "wr",
      aliases: ["바벨 오버헤드 숄더 프레스", "바벨 오버 헤드 프레스", "오버헤드프레스", "오버헤드 프레스", "O.H.P", "OHP", "밀리터리 프레스"],
      desc: "배와 엉덩이에 힘을 주어 허리가 꺾이지 않게 버티고, 바를 얼굴 앞으로 곧게 밀어 올린 뒤 머리 위에서는 바가 귀 선 위에 오게 해 주세요. 내릴 때는 쇄골까지 천천히." },
    { key: "standing_shoulder_press", name: "스탠딩 숄더 프레스", part: "어깨", equip: "머신", unit: "wr",
      aliases: ["스탠딩 숄더 프레스(어깨)", "스탠딩 숄더프레스", "스탠딩 숄더 프레스 (어깨)"],
      desc: "복부에 힘을 주어 허리가 젖혀지지 않게 하고 손잡이를 머리 위로 곧게 밀어 주세요. 내릴 때는 팔꿈치가 몸 앞쪽 45도를 유지하며 어깨 높이까지만 내립니다." },
    { key: "db_shoulder_press", name: "덤벨 숄더 프레스", part: "어깨", equip: "덤벨", unit: "wr",
      aliases: ["덤벨 시티드 숄더 프레스", "시티드 덤벨 숄더 프레스", "덤벨 숄더프레스", "시티드 숄더 프레스"],
      desc: "등받이에 등을 붙이고 어깨를 으쓱하지 않은 채 양쪽 덤벨을 균형 있게 위로 밀어 올리고, 귀 높이까지 천천히 내려 어깨에 긴장을 유지해 주세요." },
    { key: "machine_shoulder_press", name: "머신 숄더 프레스", part: "어깨", equip: "머신", unit: "wr",
      aliases: ["숄더 프레스 머신", "머신 숄더프레스"],
      desc: "손잡이가 어깨 높이에 오도록 시트를 맞추고, 등을 등받이에 붙인 채 손잡이를 위로 밀어 올려 주세요. 어깨가 으쓱 올라가지 않게 내린 상태로 밉니다." },
    { key: "db_lateral_raise", name: "덤벨 사이드 레터럴 레이즈", part: "어깨", equip: "덤벨", unit: "wr",
      aliases: ["덤벨 사레레", "사이드 레터럴 레이즈", "사레레", "레터럴 레이즈", "덤벨 레터럴 레이즈"],
      desc: "어깨가 으쓱하지 않게 내린 상태로 팔꿈치를 살짝 굽히고, 덤벨을 어깨 높이까지 양옆으로 들어 올려 어깨 옆쪽에 힘을 주세요. 새끼손가락 쪽이 살짝 높게, 내릴 때 천천히." },
    { key: "cable_front_raise", name: "케이블 프론트 레이즈", part: "어깨", equip: "케이블", unit: "wr",
      aliases: ["프론트 레이즈", "케이블 프런트 레이즈"],
      desc: "몸을 뒤로 젖히지 않고 손잡이를 눈높이까지 앞으로 들어 올려 어깨 앞쪽에 힘을 주세요. 반동 없이 팔꿈치를 살짝 굽힌 채 움직입니다." },
    { key: "rear_delt_fly", name: "리어 델트 플라이", part: "어깨", equip: "머신", unit: "wr", sub: "후면",
      aliases: ["리버스 펙 덱 플라이", "리버스 펙덱 플라이", "리어델트 플라이 (후면)", "리어델트 플라이(후면)", "리버스 펙덱", "리어 델트 플라이"],
      desc: "가슴을 패드에 붙이고 팔꿈치를 살짝 굽힌 채 팔을 양옆으로 벌려 어깨 뒤쪽에 힘을 주세요. 승모로 으쓱하지 않고 견갑을 과하게 모으지 않습니다." },
    { key: "db_bentover_raise", name: "덤벨 벤트오버 레이즈", part: "어깨", equip: "덤벨", unit: "wr", sub: "후면",
      aliases: ["덤벨 벤트오버 리어델트 레이즈", "벤트오버 레터럴 레이즈", "벤트오버 레이즈"],
      desc: "가슴을 벤치에 기대거나 상체를 숙인 채, 팔을 양옆으로 벌려 올리며 어깨 뒤쪽에 힘을 주세요. 팔꿈치가 손보다 높게, 반동 없이 가볍게 움직입니다." },
    { key: "cable_face_pull", name: "케이블 페이스 풀", part: "어깨", equip: "케이블", unit: "wr", sub: "후면",
      aliases: ["케이블 페이스풀", "페이스 풀", "페이스풀"],
      desc: "로프를 얼굴 높이에 두고 팔꿈치를 양옆으로 벌리며 얼굴 쪽으로 당겨, 마지막에 손이 귀 옆에 오도록 어깨 뒤쪽과 등 위쪽을 모아 주세요." },
    { key: "cable_external_rotation", name: "케이블 익스터널 로테이션", part: "어깨", equip: "케이블", unit: "wr", sub: "회전근개",
      aliases: ["케이블 외회전", "익스터널 로테이션"],
      desc: "팔꿈치를 옆구리에 붙여 고정하고 팔뚝만 바깥으로 천천히 돌려 어깨 회전근을 강화해 주세요. 가벼운 무게로 반동 없이 합니다." },
    { key: "ez_upright_row", name: "이지바 업라이트 로우", part: "어깨", equip: "이지바", unit: "wr",
      aliases: ["이지 바 업라이트 로우", "업라이트 로우", "EZ바 업라이트 로우"],
      desc: "팔꿈치가 손보다 높게 올라가도록 바를 몸에 붙여 가슴 높이까지 끌어올려 어깨 옆쪽과 승모근에 힘을 주세요. 어깨가 불편하면 가슴 아래까지만 올립니다." },
    { key: "y_raise", name: "Y 레이즈 웜업", part: "어깨", equip: "맨몸", unit: "reps", sub: "웜업",
      aliases: ["Y 레이즈", "Y레이즈", "와이 레이즈"],
      desc: "상체를 숙이거나 벤치에 엎드려 엄지가 위를 향하게 팔을 Y자로 들어 올려 어깨 뒤쪽과 견갑 아래 근육을 깨워 주세요. 가볍게 15회 정도로 본 운동을 준비합니다." },
    { key: "band_warmup", name: "밴드 웜업", part: "어깨", equip: "밴드", unit: "reps", sub: "웜업",
      aliases: ["밴드 어깨 웜업", "저항 밴드 웜업"],
      desc: "밴드의 저항을 이용해 풀어파트·외회전·벌리기를 가볍게 반복하며 어깨 주변 근육을 움직여 본 운동을 준비해 주세요." },

    // ---------- 팔 ----------
    { key: "barbell_curl", name: "바벨 컬", part: "팔", equip: "바벨", unit: "wr", sub: "이두",
      aliases: ["바벨 컬 (이두)", "바벨컬", "바벨 컬(이두)"],
      desc: "팔꿈치를 옆구리에 고정하고 몸 반동 없이 바를 들어 올리며, 내릴 때도 천천히 이두를 느껴 주세요. 손목은 꺾지 않고 바를 꽉 쥡니다." },
    { key: "ez_curl", name: "이지바 컬", part: "팔", equip: "이지바", unit: "wr", sub: "이두",
      aliases: ["이지 바 이두 컬", "이지바 컬", "이지 바 컬(이두)", "이지 바 컬 (이두)", "EZ바 컬", "이지바 이두 컬"],
      desc: "팔꿈치를 몸 옆에 고정하고 팔 앞쪽에 힘을 주어 바를 들어 올린 뒤, 내릴 때 팔이 완전히 펴지기 직전까지 천천히 버텨 주세요." },
    { key: "db_curl", name: "덤벨 컬", part: "팔", equip: "덤벨", unit: "wr", sub: "이두",
      aliases: ["덤벨컬", "얼터네이트 덤벨 컬"],
      desc: "상체를 흔들지 말고 팔꿈치를 고정한 채 덤벨을 들어 올리고, 올라가면서 손바닥이 위를 보게 돌려 이두를 짜 주세요. 내릴 때도 천천히 버팁니다." },
    { key: "db_hammer_curl", name: "덤벨 해머 컬", part: "팔", equip: "덤벨", unit: "wr", sub: "이두",
      aliases: ["해머 컬", "해머컬"],
      desc: "손바닥이 서로 마주 보도록 덤벨을 잡고 팔꿈치를 고정한 채 굽혀 팔 앞쪽과 전완에 힘을 주세요." },
    { key: "cable_hammer_curl", name: "케이블 해머 컬", part: "팔", equip: "케이블", unit: "wr", sub: "이두",
      aliases: ["케이블 로프 해머 컬", "로프 해머 컬"],
      desc: "손바닥이 마주 보게 로프를 잡고 팔꿈치를 고정한 채 당겨 올려 팔 바깥쪽과 전완에 힘을 주세요. 케이블 장력이 계속 걸리므로 내릴 때도 천천히." },
    { key: "cable_pushdown", name: "케이블 푸쉬다운", part: "팔", equip: "케이블", unit: "wr", sub: "삼두",
      aliases: ["케이블 푸쉬다운", "케이블 푸시다운", "케이블 푸쉬 다운 (삼두)", "케이블 푸쉬 다운(삼두)", "케이블 트라이셉스 푸쉬다운", "푸쉬다운", "트라이셉스 푸쉬다운"],
      desc: "팔꿈치가 앞뒤로 움직이지 않게 몸 옆에 고정하고 손잡이를 허벅지까지 눌러 삼두에 힘을 주세요. 어깨가 말리지 않게 가슴을 펴고 합니다." },
    { key: "cable_rope_pushdown", name: "케이블 로프 푸쉬다운", part: "팔", equip: "케이블", unit: "wr", sub: "삼두",
      aliases: ["로프 푸쉬다운", "케이블 로프 푸쉬 다운", "로프 푸시다운"],
      desc: "팔꿈치를 몸 옆에 고정하고 로프를 끝까지 내리며 마지막에 양옆으로 벌려 삼두를 짜 주세요. 올라올 때는 팔꿈치 각도가 90도를 넘지 않게 천천히." },
    { key: "cable_overhead_ext", name: "케이블 오버헤드 익스텐션", part: "팔", equip: "케이블", unit: "wr", sub: "삼두",
      aliases: ["케이블 오버 익스텐션", "케이블 오버헤드 트라이셉스 익스텐션", "오버헤드 익스텐션", "오버헤드 트라이셉스 익스텐션"],
      desc: "상체를 앞으로 기울이고 팔꿈치 위치를 고정한 채 팔을 앞으로 펴서 삼두 긴 머리를 늘였다 수축해 주세요. 허리가 꺾이지 않게 배에 힘을 줍니다." },
    { key: "ez_lying_triceps_ext", name: "이지바 라잉 트라이셉스 익스텐션", part: "팔", equip: "이지바", unit: "wr", sub: "삼두",
      aliases: ["이지바 라잉 트라이셉스 익스텐션", "라잉 트라이셉스 익스텐션", "스컬크러셔", "EZ바 라잉 트라이셉스 익스텐션"],
      desc: "벤치에 누워 팔꿈치 위치를 고정한 채 바를 이마 쪽으로 천천히 내렸다가 펴 올려 삼두에 힘을 주세요. 팔꿈치가 양옆으로 벌어지지 않게 유지합니다." },
    { key: "barbell_lying_triceps_ext", name: "바벨 라잉 트라이셉스 익스텐션", part: "팔", equip: "바벨", unit: "wr", sub: "삼두",
      aliases: ["바벨 라잉 트라이셉스", "바벨 스컬크러셔"],
      desc: "팔꿈치가 양옆으로 벌어지지 않게 고정한 채 바를 이마 쪽으로 내렸다가 팔 뒤쪽 힘으로 펴 주세요. 어깨가 아니라 팔꿈치 관절만 움직입니다." },

    // ---------- 하체 ----------
    { key: "barbell_squat", name: "바벨 스쿼트", part: "하체", equip: "바벨", unit: "wr",
      aliases: ["스쿼트", "백 스쿼트", "바벨 백 스쿼트", "바벨스쿼트"],
      desc: "가슴을 편 채 엉덩이를 뒤로 빼며 앉고, 무릎이 발끝 방향을 따라가며 안쪽으로 모이지 않게 발바닥 전체로 밀고 일어나 주세요. 허벅지가 바닥과 평행할 때까지 내려갑니다." },
    { key: "leg_press", name: "레그 프레스", part: "하체", equip: "머신", unit: "wr",
      aliases: ["레그 프레스 (하체)", "레그 프레스(하체)", "레그프레스"],
      desc: "발은 어깨너비로 발판 중앙에 두고, 엉덩이가 시트에서 뜨지 않는 범위까지 무릎을 굽혔다가 발바닥 전체로 밀어 주세요. 무릎을 끝까지 잠그지 않습니다." },
    { key: "leg_curl", name: "레그 컬", part: "하체", equip: "머신", unit: "wr", sub: "햄스트링",
      aliases: ["레그컬", "라잉 레그 컬", "시티드 레그 컬"],
      desc: "골반을 패드에 붙이고 무릎을 굽혀 허벅지 뒤쪽에 힘을 주세요. 올릴 때 엉덩이가 들리지 않게 하고, 내릴 때 천천히 버팁니다." },
    { key: "leg_extension", name: "레그 익스텐션", part: "하체", equip: "머신", unit: "wr", sub: "대퇴사두",
      aliases: ["레그익스텐션"],
      desc: "허벅지 앞쪽에 힘을 주어 무릎을 끝까지 펴고 잠깐 멈춘 뒤, 내릴 때도 천천히 버텨 주세요. 등은 등받이에 붙이고 손잡이를 잡아 몸을 고정합니다." },
    { key: "lunge", name: "런지", part: "하체", equip: "덤벨", unit: "wr",
      aliases: ["덤벨 런지", "워킹 런지"],
      desc: "앞발에 체중을 싣고 내려가며 허벅지와 엉덩이에 힘을 주고, 상체가 흔들리지 않게 배에 힘을 준 채 앞발 뒤꿈치로 밀어 올라와 주세요. 앞무릎이 발끝을 많이 넘지 않게 합니다." },
    { key: "monster_glute", name: "몬스터 글루트", part: "하체", equip: "머신", unit: "wr", sub: "둔근",
      aliases: ["몬스터글루트", "힙 어브덕션", "어브덕션 머신"],
      desc: "허리를 과하게 젖히지 않고 엉덩이 옆쪽에 힘을 주어 다리를 벌린 뒤, 천천히 버티며 모아 주세요. 상체를 살짝 숙이면 엉덩이 옆쪽 자극이 커집니다." },
    { key: "inner_thigh", name: "이너 타이", part: "하체", equip: "머신", unit: "wr", sub: "내전근",
      aliases: ["이너 타이", "힙 어덕션", "어덕션 머신"],
      desc: "허벅지 안쪽에 힘을 주어 다리를 모으고 잠깐 멈춘 뒤, 벌릴 때는 당기는 느낌이 드는 범위까지만 천천히 열어 주세요." },

    // ---------- 코어 / 유산소 ----------
    { key: "plank", name: "플랭크", part: "코어", equip: "맨몸", unit: "time",
      aliases: ["플랭크 홀드"],
      desc: "팔꿈치를 어깨 아래 두고 머리부터 발끝까지 일직선을 만든 뒤, 배와 엉덩이에 힘을 주어 허리가 꺾이거나 엉덩이가 솟지 않게 버텨 주세요." },
    { key: "running", name: "러닝", part: "유산소", equip: "유산소", unit: "dist",
      aliases: ["달리기", "트레드밀", "런닝"],
      desc: "대화가 가능한 정도의 속도로 꾸준히 달려 주세요. 근력 운동 뒤에 하면 20~30분, 단독으로 하면 거리·시간을 조금씩 늘려 갑니다." },
    { key: "incline_walk", name: "인클라인 워킹", part: "유산소", equip: "유산소", unit: "cardio",
      aliases: ["인클라인", "경사 걷기", "트레드밀 인클라인", "인클라인 트레드밀"],
      desc: "트레드밀 경사 10~15%, 속도 5~6km/h로 손잡이를 잡지 않고 걸어 주세요. 상체를 살짝 앞으로 기울이고 뒤꿈치부터 디디며 엉덩이·허벅지 뒤쪽으로 밀어 올라갑니다. 20~30분, 숨은 차되 대화는 되는 강도." },
    { key: "stair_climber", name: "천국의 계단", part: "유산소", equip: "유산소", unit: "cardio",
      aliases: ["스텝밀", "스테어 클라이머", "계단 오르기", "천국의계단"],
      desc: "손잡이에 체중을 싣지 말고 가볍게만 짚은 채, 발바닥 전체로 계단을 밟고 엉덩이 힘으로 올라가 주세요. 처음엔 레벨 5~7로 10~15분, 익숙해지면 시간·레벨을 조금씩 올립니다." },

    // ---------- 사전에만 있는 추천 종목(내 종목 목록에는 안 들어감, 종목 선택 시트의 '사전에서 추가'로 고른다) ----------
    { key: "hip_thrust", name: "힙 쓰러스트", part: "하체", equip: "바벨", unit: "wr", sub: "둔근", aliases: ["바벨 힙 쓰러스트", "힙쓰러스트"],
      desc: "견갑 아래를 벤치에 대고 바벨을 골반 위에 올린 뒤, 발뒤꿈치로 바닥을 밀어 엉덩이를 들어 올려 무릎·골반·어깨가 일직선이 되는 지점에서 엉덩이를 꽉 조여 주세요. 턱은 당기고 허리는 젖히지 않습니다." },
    { key: "bulgarian_split_squat", name: "불가리안 스플릿 스쿼트", part: "하체", equip: "덤벨", unit: "wr", aliases: ["불스쿼", "스플릿 스쿼트"],
      desc: "뒷발을 벤치에 올리고 앞발에 체중을 실어 앞 허벅지가 바닥과 평행할 때까지 내려갔다가 앞발 뒤꿈치로 밀어 올라와 주세요. 상체는 살짝 숙이고 무릎은 발끝 방향을 따라갑니다." },
    { key: "cable_crossover", name: "케이블 크로스오버", part: "가슴", equip: "케이블", unit: "wr", aliases: ["케이블 플라이", "크로스오버"],
      desc: "한 발을 앞에 두고 상체를 살짝 숙인 채, 팔꿈치를 약간 굽힌 상태로 양손을 몸 앞에서 교차하듯 모아 가슴 안쪽을 짜 주세요. 돌아갈 때는 가슴이 늘어나는 범위까지만 천천히." },
    { key: "hanging_leg_raise", name: "행잉 레그 레이즈", part: "코어", equip: "맨몸", unit: "reps", aliases: ["레그 레이즈", "행잉 니 레이즈"],
      desc: "바에 매달려 몸이 흔들리지 않게 잡고, 골반을 말아 올리는 느낌으로 다리를 들어 올려 주세요. 반동 없이 내릴 때도 천천히. 힘들면 무릎을 굽혀(니 레이즈) 시작합니다." },
    { key: "cable_crunch", name: "케이블 크런치", part: "코어", equip: "케이블", unit: "wr", aliases: ["니링 케이블 크런치"],
      desc: "로프를 머리 옆에 고정한 채 무릎을 꿇고, 팔이 아니라 배를 말아 올리는 힘으로 팔꿈치를 허벅지 쪽으로 가져가 복근을 짜 주세요. 엉덩이는 뒤로 빠지지 않게 고정합니다." },
    { key: "side_plank", name: "사이드 플랭크", part: "코어", equip: "맨몸", unit: "time", aliases: ["사이드플랭크"],
      desc: "팔꿈치를 어깨 아래에 두고 옆으로 누워 골반을 들어 올려 머리부터 발끝까지 일직선을 만든 뒤, 엉덩이가 처지지 않게 옆구리에 힘을 주어 버텨 주세요." },
  ];

  const byKey = {}; EX.forEach((e) => (byKey[e.key] = e));

  // ---------- 이름 정규화 ----------
  // "벤치 프레스 (Barbell Bench Press) - 30kg" → "벤치프레스"
  function norm(s) {
    return String(s || "")
      .replace(/\([^)]*\)/g, " ")           // 괄호 내용(영문명·부위) 제거
      .replace(/\s*[-–—]\s*.*$/, "")        // " - 30kg" 같은 꼬리 제거
      .replace(/[·.]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }
  const INDEX = {};
  EX.forEach((e) => { INDEX[norm(e.name)] = e.key; (e.aliases || []).forEach((a) => (INDEX[norm(a)] = e.key)); });

  // 이름 → 표준 종목 key (없으면 null). "행 데드 + 케이블 페이스풀"처럼 묶인 이름은 첫 종목.
  function match(name) {
    const parts = String(name || "").split("+");
    for (const p of parts) { const k = INDEX[norm(p)]; if (k) return k; }
    // 부분 일치(이름 안에 표준명이 들어 있는 경우)
    const n = norm(name);
    let best = null;
    for (const key in INDEX) { if (key.length >= 4 && n.includes(key) && (!best || key.length > best.length)) best = key; }
    return best ? INDEX[best] : null;
  }
  function matchAll(name) {
    const out = [];
    String(name || "").split("+").forEach((p) => { const k = match(p); if (k && !out.includes(k)) out.push(k); });
    return out;
  }
  // "- 30kg", "중량: 25kg", "20kg(빈 바)", "턱걸이 65kg" → 숫자(kg) 또는 null
  function parseWeight(s) { const m = String(s || "").match(/(\d+(?:\.\d+)?)\s*kg/i); return m ? +m[1] : null; }

  // ---------- 추천 루틴 프리셋 ----------
  // sets/reps/rest 기본: PT 패턴(3×15) + 점진 과부하는 앱에서 제안. w는 시작 중량 참고(없으면 지난 기록으로 채움).
  const R = (key, sets, reps, w, rest) => ({ key, sets: sets || 3, reps: reps || 15, w: w == null ? undefined : w, rest: rest || 90 });
  const PRESETS = [
    { id: "p_chest", name: "가슴 (+삼두)", parts: ["가슴", "팔"], src: "PT 11/4·9/30 기반",
      items: [R("bench_press", 4, 10, 50, 120), R("incline_db_press", 3, 15, 10), R("machine_chest_press", 3, 15, 40), R("pec_deck", 3, 15, 40), R("assisted_dips", 3, 15, 50), R("cable_rope_pushdown", 3, 15, 25)] },
    { id: "p_back", name: "등 (+이두)", parts: ["등", "팔"], src: "PT 10/29·10/13·11/7 기반",
      items: [R("band_pullup", 3, 12, null, 90), R("deadlift", 3, 12, 60, 150), R("barbell_row", 3, 15, 40, 120), R("one_arm_db_row", 3, 15, 15), R("seated_row", 3, 15, 25), R("lat_pulldown", 3, 15, 30), R("straight_arm_pulldown", 3, 15, 15), R("barbell_curl", 3, 15, 25)] },
    { id: "p_shoulder", name: "어깨", parts: ["어깨"], src: "PT 11/11·10/9 기반",
      items: [R("cable_external_rotation", 2, 15, 5, 45), R("barbell_ohp", 4, 12, 25, 120), R("db_shoulder_press", 3, 15, 12), R("db_lateral_raise", 4, 15, 7, 60), R("cable_face_pull", 3, 15, 30, 60), R("db_bentover_raise", 3, 15, 4, 60), R("ez_upright_row", 3, 15, 10), R("machine_shoulder_press", 3, 15, 25)] },
    { id: "p_arms", name: "팔 (이두·삼두)", parts: ["팔"], src: "PT 11/14·11/7 기반",
      items: [R("jump_pullup", 3, 12, null, 60), R("dips", 3, 12, null, 90), R("barbell_curl", 3, 15, 25), R("barbell_lying_triceps_ext", 3, 15, 20), R("db_curl", 3, 20, 7, 60), R("cable_rope_pushdown", 3, 15, 25, 60), R("cable_hammer_curl", 3, 15, 20, 60), R("cable_overhead_ext", 3, 15, 30, 60)] },
    { id: "p_legs", name: "하체", parts: ["하체"], src: "PT 10/15·8/27 기반",
      items: [R("leg_extension", 3, 15, 30, 60), R("barbell_squat", 4, 12, 40, 150), R("leg_press", 3, 15, 40, 120), R("lunge", 3, 12, 6), R("leg_curl", 3, 15, 25), R("monster_glute", 3, 15, 15, 60), R("inner_thigh", 3, 15, 30, 60)] },
    { id: "p_full_a", name: "전신 A (머신 위주)", parts: ["가슴", "등", "어깨", "하체"], src: "PT 8/31·9/10 전신 기반",
      items: [R("assisted_pullup", 3, 15, 60), R("lat_pulldown", 3, 15, 30), R("bench_press", 3, 12, 40, 120), R("machine_chest_press", 3, 15, 40), R("machine_shoulder_press", 3, 15, 25), R("seated_row", 3, 15, 25), R("leg_press", 3, 15, 40, 120)] },
    { id: "p_full_b", name: "전신 B (바벨 기본기)", parts: ["하체", "가슴", "등", "어깨", "코어"], src: "5대 기본 동작, 주 1회 근력 점검용",
      items: [R("barbell_squat", 4, 8, 40, 150), R("bench_press", 4, 8, 50, 150), R("barbell_row", 4, 10, 40, 120), R("barbell_ohp", 3, 10, 25, 120), R("rdl", 3, 12, 60, 120), R("plank", 3, 1, null, 60)] },
    { id: "p_push", name: "밀기 (가슴·어깨·삼두)", parts: ["가슴", "어깨", "팔"], src: "3분할용",
      items: [R("bench_press", 4, 10, 50, 120), R("barbell_ohp", 3, 12, 25, 120), R("incline_db_press", 3, 15, 10), R("db_lateral_raise", 4, 15, 7, 60), R("pec_deck", 3, 15, 40), R("cable_pushdown", 3, 15, 20, 60)] },
    { id: "p_pull", name: "당기기 (등·후면·이두)", parts: ["등", "어깨", "팔"], src: "3분할용",
      items: [R("deadlift", 3, 10, 60, 150), R("lat_pulldown", 3, 15, 30), R("barbell_row", 3, 15, 40, 120), R("seated_row", 3, 15, 25), R("cable_face_pull", 3, 15, 30, 60), R("barbell_curl", 3, 15, 25, 60), R("db_hammer_curl", 3, 15, 5, 60)] },
  ];
  // 주간 프로그램(루틴 묶음)
  const PROGRAMS = [
    { id: "w4", name: "주 4회 · 4분할", days: ["p_chest", "p_back", "p_shoulder", "p_legs"], note: "가슴 → 등 → 어깨 → 하체. 팔은 가슴·등 날 마지막에 1~2종목 포함. 주 1회 휴식 2일 연속 배치." },
    { id: "w3", name: "주 3회 · 밀기/당기기/하체", days: ["p_push", "p_pull", "p_legs"], note: "시간이 적을 때. 각 날 60분 안쪽으로 끝내고 복합 운동(벤치·데드·스쿼트)부터 합니다." },
    { id: "w2", name: "주 2회 · 전신", days: ["p_full_a", "p_full_b"], note: "바쁜 주에 유지용. A는 머신으로 안전하게, B는 바벨로 중량 점검." },
  ];

  // 다음 추천 루틴 순환 순서(분할 기준)
  const ROTATION = ["p_chest", "p_back", "p_shoulder", "p_legs", "p_arms"];

  return { PARTS, EQUIPS, STEP, EXTRA_ONLY, EX, byKey, norm, match, matchAll, parseWeight, PRESETS, PROGRAMS, ROTATION };
});
