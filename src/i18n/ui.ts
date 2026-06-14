// 화면에 노출되는 UI 문자열 — 로케일별 번역.
// SEO 에 영향이 큰 페이지 title/description/tagline 은 content.ts 에서 따로 관리한다.
import type { Locale } from './config';

export interface UIStrings {
  /** 언어 스위처 접근성 라벨 */
  langSwitcher: string;
  footer: string;
  home: {
    h1: string;
    lede: string;
    /** "{format} 로 변환" 형태. {format} 는 WEBP/AVIF 로 치환된다. */
    cardTitle: (format: string) => string;
    /** 이미지 분석기 카드 제목 */
    analyzerCard: string;
    /** 기능 섹션 제목 — 이미지 / 동영상 / 그 외 */
    sections: { image: string; video: string; other: string };
  };
  tool: {
    /** "{format} 변환기" */
    heading: (format: string) => string;
    featuresTitle: string;
    features: string[];
    note: string;
  };
  analyzer: {
    /** 페이지 제목(h1) */
    title: string;
    dropText: string;
    dropSub: string;
    analyzing: string;
    /** 다른 이미지 분석(초기화) */
    another: string;
    /** "{format} 로 변환" 버튼. {format} 는 WEBP/AVIF. */
    convertTo: (format: string) => string;
    /** EXIF 없음 안내 */
    noExif: string;
    /** 지도에서 보기 */
    viewOnMap: string;
    failed: string;
    /** 그룹(섹션) 헤더 */
    groups: { file: string; image: string; exif: string; gps: string };
    /** 필드 라벨 — analyze.ts 의 field key 로 찾는다. */
    fields: Record<string, string>;
  };
  converter: {
    dropText: string;
    dropSub: string;
    quality: string;
    converting: string;
    download: string;
    /** "전체 다운로드 (N)" — {n} 를 개수로 치환한다. */
    downloadAll: (n: number | string) => string;
    /** 한 장 삭제 (아이콘 버튼 라벨) */
    delete: string;
    /** 전체 삭제 버튼 */
    clearAll: string;
    /** 전체 삭제 확인 메시지 */
    clearAllConfirm: string;
    failed: string;
    /** 라이트박스(크게보기) 관련 */
    close: string;
    info: {
      dimensions: string;
      original: string;
      converted: string;
      saved: string;
      quality: string;
      format: string;
    };
  };
  video: {
    /** 페이지 제목(h1) */
    title: string;
    dropText: string;
    dropSub: string;
    /** 구간 트림 라벨 */
    trim: string;
    start: string;
    end: string;
    /** 현재 재생 위치를 시작/끝 지점으로 설정하는 버튼 */
    setStart: string;
    setEnd: string;
    fps: string;
    width: string;
    quality: string;
    loop: string;
    /** 반복 입력 보조 설명 (예: "0 = 무한") */
    loopHint: string;
    /** 예상 프레임 수 — {n} 치환 */
    estFrames: (n: number | string) => string;
    /** 프레임이 너무 많을 때 경고 문구 */
    tooMany: string;
    generate: string;
    /** 생성 진행률 — {done}/{total} 치환 */
    generating: (done: number | string, total: number | string) => string;
    /** 결과 통계 라벨 */
    result: { size: string; dimensions: string; frames: string; duration: string };
    download: string;
    /** 다른 동영상으로 다시 시작 */
    another: string;
    failed: string;
    /** 코덱 미지원 안내 */
    unsupported: string;
    /** 비디오 트랙 없음 안내 */
    noVideo: string;
    /** 파일 읽기 실패 안내(클라우드 미다운로드 등) */
    readFailed: string;
  };
  slackEmoji: {
    /** 페이지 제목(h1) */
    title: string;
    /** 텍스트 입력 라벨 */
    text: string;
    /** 텍스트 입력 placeholder */
    textPlaceholder: string;
    /** 줄바꿈 입력 보조 설명 */
    textHint: string;
    textColor: string;
    bgColor: string;
    /** 배경 투명 토글 */
    transparent: string;
    bold: string;
    font: string;
    download: string;
    /** 사용 안내(규격/업로드 방법) */
    note: string;
  };
}

export const UI: Record<Locale, UIStrings> = {
  en: {
    langSwitcher: 'Language',
    footer: 'All conversions run inside your browser. Your images are never uploaded to a server.',
    home: {
      h1: 'WebTools',
      lede: 'Image tools that run right in your browser. No uploads, no install, free.',
      cardTitle: (f) => `Convert to ${f}`,
      analyzerCard: 'Analyze an image',
      sections: { image: 'Image tools', video: 'Video tools', other: 'Other' },
    },
    tool: {
      heading: (f) => `${f} Converter`,
      featuresTitle: 'Features',
      features: [
        '<strong>No server uploads</strong> — every conversion runs inside your browser.',
        '<strong>Batch conversion</strong> — drop several files at once.',
        '<strong>Quality control</strong> — balance file size and clarity with a slider.',
      ],
      note: 'Note: for animated images only the first frame is converted. Preserving motion requires a separate tool.',
    },
    analyzer: {
      title: 'Image Analyzer',
      dropText: 'Drop an image here, or click to choose',
      dropSub: 'JPG · PNG · GIF · WebP · AVIF · HEIC and more',
      analyzing: 'Analyzing…',
      another: 'Analyze another',
      convertTo: (f) => `Convert to ${f}`,
      noExif: 'No EXIF metadata found in this image.',
      viewOnMap: 'View on map',
      failed: 'Could not analyze this file',
      groups: { file: 'File', image: 'Image', exif: 'Camera (EXIF)', gps: 'Location' },
      fields: {
        name: 'Name',
        formatDetected: 'Format',
        size: 'File size',
        modified: 'Modified',
        dimensions: 'Dimensions',
        megapixels: 'Megapixels',
        aspect: 'Aspect ratio',
        colorType: 'Color type',
        bitDepth: 'Bit depth',
        alpha: 'Transparency',
        interlaced: 'Interlaced',
        camera: 'Camera',
        lens: 'Lens',
        dateTaken: 'Date taken',
        exposure: 'Exposure',
        aperture: 'Aperture',
        iso: 'ISO',
        focalLength: 'Focal length',
        orientation: 'Orientation',
        software: 'Software',
        coordinates: 'Coordinates',
      },
    },
    converter: {
      dropText: 'Drag images here, or click to choose',
      dropSub: 'JPG · PNG · GIF · WebP · AVIF and more / multiple files at once',
      quality: 'Quality',
      converting: 'Converting…',
      download: 'Download',
      downloadAll: (n) => `Download all (${n})`,
      delete: 'Delete',
      clearAll: 'Clear all',
      clearAllConfirm: 'Delete all converted images? This cannot be undone.',
      failed: 'Failed',
      close: 'Close',
      info: {
        dimensions: 'Dimensions',
        original: 'Original',
        converted: 'Converted',
        saved: 'Saved',
        quality: 'Quality',
        format: 'Format',
      },
    },
    video: {
      title: 'Video to Animated WebP',
      dropText: 'Drop a video here, or click to choose',
      dropSub: 'MP4 · MOV · M4V (H.264 / AV1) — trim a clip into an animated WebP',
      trim: 'Trim',
      start: 'Start',
      end: 'End',
      setStart: 'Set start here',
      setEnd: 'Set end here',
      fps: 'FPS',
      width: 'Width',
      quality: 'Quality',
      loop: 'Loop',
      loopHint: '0 = infinite',
      estFrames: (n) => `≈ ${n} frames`,
      tooMany: 'large file & slow encode',
      generate: 'Create animated WebP',
      generating: (d, t) => `Encoding frame ${d} / ${t}`,
      result: { size: 'Size', dimensions: 'Dimensions', frames: 'Frames', duration: 'Duration' },
      download: 'Download',
      another: 'Another video',
      failed: 'Failed',
      unsupported: 'This video codec can’t be decoded in your browser. Try an H.264 MP4.',
      noVideo: 'No video track was found in this file.',
      readFailed: 'Couldn’t read this file. If it’s in cloud storage (iCloud / OneDrive), download it to your device first, then try again.',
    },
    slackEmoji: {
      title: 'Slack Emoji Maker',
      text: 'Text',
      textPlaceholder: 'LGTM',
      textHint: 'Tip: press Enter to split into multiple lines.',
      textColor: 'Text',
      bgColor: 'Background',
      transparent: 'Transparent',
      bold: 'Bold',
      font: 'Font',
      download: 'Download PNG',
      note: 'Exports a 128×128 PNG — Slack’s recommended size. Upload it in Slack via Add emoji.',
    },
  },

  ko: {
    langSwitcher: '언어',
    footer: '모든 변환은 브라우저 안에서 처리됩니다. 이미지는 서버로 전송되지 않습니다.',
    home: {
      h1: 'WebTools',
      lede: '브라우저에서 바로 쓰는 이미지 도구. 업로드 없음, 설치 없음, 무료.',
      cardTitle: (f) => `${f} 로 변환`,
      analyzerCard: '이미지 분석',
      sections: { image: '이미지 도구', video: '동영상 도구', other: '그 외' },
    },
    tool: {
      heading: (f) => `${f} 변환기`,
      featuresTitle: '특징',
      features: [
        '<strong>서버 업로드 없음</strong> — 모든 변환이 브라우저 안에서 실행됩니다.',
        '<strong>여러 장 동시 변환</strong> — 한 번에 여러 파일을 끌어다 놓으세요.',
        '<strong>품질 조절</strong> — 슬라이더로 용량과 화질의 균형을 맞춥니다.',
      ],
      note: '참고: 애니메이션 이미지는 첫 프레임만 변환됩니다. 움직임 보존이 필요하면 별도 도구가 필요합니다.',
    },
    analyzer: {
      title: '이미지 분석기',
      dropText: '이미지를 드래그하거나 클릭해 선택하세요',
      dropSub: 'JPG · PNG · GIF · WebP · AVIF · HEIC 등',
      analyzing: '분석 중…',
      another: '다른 이미지 분석',
      convertTo: (f) => `${f} 로 변환`,
      noExif: '이 이미지에는 EXIF 메타데이터가 없습니다.',
      viewOnMap: '지도에서 보기',
      failed: '이 파일을 분석할 수 없습니다',
      groups: { file: '파일', image: '이미지', exif: '카메라 (EXIF)', gps: '위치' },
      fields: {
        name: '이름',
        formatDetected: '포맷',
        size: '용량',
        modified: '수정일',
        dimensions: '크기',
        megapixels: '메가픽셀',
        aspect: '가로세로비',
        colorType: '색상 유형',
        bitDepth: '비트 심도',
        alpha: '투명도',
        interlaced: '인터레이스',
        camera: '카메라',
        lens: '렌즈',
        dateTaken: '촬영일',
        exposure: '노출',
        aperture: '조리개',
        iso: 'ISO',
        focalLength: '초점 거리',
        orientation: '방향',
        software: '소프트웨어',
        coordinates: '좌표',
      },
    },
    converter: {
      dropText: '이미지를 드래그하거나 클릭해 선택하세요',
      dropSub: 'JPG · PNG · GIF · WebP · AVIF 등 / 여러 장 동시 가능',
      quality: '품질',
      converting: '변환 중…',
      download: '다운로드',
      downloadAll: (n) => `전체 다운로드 (${n})`,
      delete: '삭제',
      clearAll: '전체 삭제',
      clearAllConfirm: '변환한 이미지를 모두 삭제할까요? 되돌릴 수 없습니다.',
      failed: '실패',
      close: '닫기',
      info: {
        dimensions: '크기',
        original: '원본',
        converted: '변환 후',
        saved: '절감',
        quality: '품질',
        format: '포맷',
      },
    },
    video: {
      title: '동영상 → 움직이는 WebP',
      dropText: '동영상을 드래그하거나 클릭해 선택하세요',
      dropSub: 'MP4 · MOV · M4V (H.264 / AV1) — 구간을 잘라 애니메이션 WebP 로',
      trim: '구간',
      start: '시작',
      end: '끝',
      setStart: '여기를 시작점으로',
      setEnd: '여기를 끝점으로',
      fps: 'FPS',
      width: '가로',
      quality: '품질',
      loop: '반복',
      loopHint: '0 = 무한',
      estFrames: (n) => `약 ${n} 프레임`,
      tooMany: '용량 크고 인코딩 느림',
      generate: '애니메이션 WebP 만들기',
      generating: (d, t) => `프레임 인코딩 ${d} / ${t}`,
      result: { size: '용량', dimensions: '크기', frames: '프레임', duration: '길이' },
      download: '다운로드',
      another: '다른 동영상',
      failed: '실패',
      unsupported: '이 동영상 코덱은 브라우저에서 디코드할 수 없습니다. H.264 MP4 를 사용해 보세요.',
      noVideo: '이 파일에서 비디오 트랙을 찾지 못했습니다.',
      readFailed: '파일을 읽지 못했습니다. iCloud·OneDrive 등 클라우드에 있는 파일이면 먼저 기기로 내려받은 뒤 다시 시도해 주세요.',
    },
    slackEmoji: {
      title: '슬랙 이모지 만들기',
      text: '텍스트',
      textPlaceholder: 'LGTM',
      textHint: '팁: Enter 로 줄을 나눌 수 있어요.',
      textColor: '글자',
      bgColor: '배경',
      transparent: '투명 배경',
      bold: '굵게',
      font: '폰트',
      download: 'PNG 다운로드',
      note: '슬랙 권장 규격인 128×128 PNG 로 저장됩니다. 슬랙의 이모지 추가에서 업로드하세요.',
    },
  },

  zh: {
    langSwitcher: '语言',
    footer: '所有转换均在您的浏览器内完成，图片不会上传到任何服务器。',
    home: {
      h1: 'WebTools',
      lede: '在浏览器中即开即用的图片工具。无需上传，无需安装，完全免费。',
      cardTitle: (f) => `转换为 ${f}`,
      analyzerCard: '分析图片',
      sections: { image: '图片工具', video: '视频工具', other: '其他' },
    },
    tool: {
      heading: (f) => `${f} 转换器`,
      featuresTitle: '特点',
      features: [
        '<strong>无需上传服务器</strong> — 所有转换都在浏览器内完成。',
        '<strong>批量转换</strong> — 可一次拖入多个文件。',
        '<strong>质量调节</strong> — 用滑块平衡文件大小与清晰度。',
      ],
      note: '注意：动图仅转换第一帧。如需保留动画效果，请使用其他工具。',
    },
    analyzer: {
      title: '图片分析器',
      dropText: '拖入图片，或点击选择',
      dropSub: 'JPG · PNG · GIF · WebP · AVIF · HEIC 等',
      analyzing: '分析中…',
      another: '分析其他图片',
      convertTo: (f) => `转换为 ${f}`,
      noExif: '此图片不包含 EXIF 元数据。',
      viewOnMap: '在地图中查看',
      failed: '无法分析此文件',
      groups: { file: '文件', image: '图片', exif: '相机 (EXIF)', gps: '位置' },
      fields: {
        name: '名称',
        formatDetected: '格式',
        size: '文件大小',
        modified: '修改时间',
        dimensions: '尺寸',
        megapixels: '百万像素',
        aspect: '宽高比',
        colorType: '颜色类型',
        bitDepth: '位深度',
        alpha: '透明度',
        interlaced: '隔行扫描',
        camera: '相机',
        lens: '镜头',
        dateTaken: '拍摄时间',
        exposure: '曝光',
        aperture: '光圈',
        iso: 'ISO',
        focalLength: '焦距',
        orientation: '方向',
        software: '软件',
        coordinates: '坐标',
      },
    },
    converter: {
      dropText: '拖入图片，或点击选择',
      dropSub: 'JPG · PNG · GIF · WebP · AVIF 等 / 支持一次多张',
      quality: '质量',
      converting: '转换中…',
      download: '下载',
      downloadAll: (n) => `全部下载 (${n})`,
      delete: '删除',
      clearAll: '全部删除',
      clearAllConfirm: '删除所有已转换的图片？此操作无法撤销。',
      failed: '失败',
      close: '关闭',
      info: {
        dimensions: '尺寸',
        original: '原始',
        converted: '转换后',
        saved: '节省',
        quality: '质量',
        format: '格式',
      },
    },
    video: {
      title: '视频转动态 WebP',
      dropText: '拖入视频，或点击选择',
      dropSub: 'MP4 · MOV · M4V（H.264 / AV1）— 裁剪片段，生成动态 WebP',
      trim: '裁剪',
      start: '开始',
      end: '结束',
      setStart: '设为起点',
      setEnd: '设为终点',
      fps: '帧率',
      width: '宽度',
      quality: '质量',
      loop: '循环',
      loopHint: '0 = 无限',
      estFrames: (n) => `约 ${n} 帧`,
      tooMany: '文件大、编码慢',
      generate: '生成动态 WebP',
      generating: (d, t) => `正在编码第 ${d} / ${t} 帧`,
      result: { size: '大小', dimensions: '尺寸', frames: '帧数', duration: '时长' },
      download: '下载',
      another: '换一个视频',
      failed: '失败',
      unsupported: '浏览器无法解码此视频编解码器。请尝试 H.264 MP4。',
      noVideo: '此文件中未找到视频轨道。',
      readFailed: '无法读取此文件。如果它存储在 iCloud 或云端，请先下载到本地再重试。',
    },
    slackEmoji: {
      title: 'Slack 表情制作',
      text: '文字',
      textPlaceholder: 'LGTM',
      textHint: '提示：按 Enter 可换行。',
      textColor: '文字',
      bgColor: '背景',
      transparent: '透明背景',
      bold: '加粗',
      font: '字体',
      download: '下载 PNG',
      note: '导出为 Slack 推荐的 128×128 PNG。在 Slack 的“添加表情”中上传即可。',
    },
  },

  ja: {
    langSwitcher: '言語',
    footer: 'すべての変換はブラウザ内で行われます。画像がサーバーに送信されることはありません。',
    home: {
      h1: 'WebTools',
      lede: 'ブラウザですぐ使える画像ツール。アップロード不要、インストール不要、無料。',
      cardTitle: (f) => `${f} に変換`,
      analyzerCard: '画像を解析',
      sections: { image: '画像ツール', video: '動画ツール', other: 'その他' },
    },
    tool: {
      heading: (f) => `${f} コンバーター`,
      featuresTitle: '特長',
      features: [
        '<strong>サーバーへのアップロードなし</strong> — すべての変換はブラウザ内で実行されます。',
        '<strong>複数まとめて変換</strong> — 一度に複数のファイルをドラッグできます。',
        '<strong>品質の調整</strong> — スライダーでファイルサイズと画質のバランスを取れます。',
      ],
      note: '注意：アニメーション画像は最初のフレームのみ変換されます。動きを保持するには別のツールが必要です。',
    },
    analyzer: {
      title: '画像アナライザー',
      dropText: '画像をドラッグするか、クリックして選択',
      dropSub: 'JPG · PNG · GIF · WebP · AVIF · HEIC など',
      analyzing: '解析中…',
      another: '別の画像を解析',
      convertTo: (f) => `${f} に変換`,
      noExif: 'この画像に EXIF メタデータはありません。',
      viewOnMap: '地図で見る',
      failed: 'このファイルを解析できませんでした',
      groups: { file: 'ファイル', image: '画像', exif: 'カメラ (EXIF)', gps: '位置情報' },
      fields: {
        name: '名前',
        formatDetected: '形式',
        size: 'ファイルサイズ',
        modified: '更新日時',
        dimensions: 'サイズ',
        megapixels: 'メガピクセル',
        aspect: 'アスペクト比',
        colorType: 'カラータイプ',
        bitDepth: 'ビット深度',
        alpha: '透明度',
        interlaced: 'インターレース',
        camera: 'カメラ',
        lens: 'レンズ',
        dateTaken: '撮影日時',
        exposure: '露出',
        aperture: '絞り',
        iso: 'ISO',
        focalLength: '焦点距離',
        orientation: '向き',
        software: 'ソフトウェア',
        coordinates: '座標',
      },
    },
    converter: {
      dropText: '画像をドラッグするか、クリックして選択',
      dropSub: 'JPG · PNG · GIF · WebP · AVIF など / 複数同時に可',
      quality: '品質',
      converting: '変換中…',
      download: 'ダウンロード',
      downloadAll: (n) => `すべてダウンロード (${n})`,
      delete: '削除',
      clearAll: 'すべて削除',
      clearAllConfirm: '変換した画像をすべて削除しますか？元に戻せません。',
      failed: '失敗',
      close: '閉じる',
      info: {
        dimensions: 'サイズ',
        original: '元のサイズ',
        converted: '変換後',
        saved: '削減',
        quality: '品質',
        format: '形式',
      },
    },
    video: {
      title: '動画 → アニメーション WebP',
      dropText: '動画をドラッグするか、クリックして選択',
      dropSub: 'MP4 · MOV · M4V（H.264 / AV1）— 区間を切り出してアニメーション WebP に',
      trim: '区間',
      start: '開始',
      end: '終了',
      setStart: 'ここを開始点に',
      setEnd: 'ここを終了点に',
      fps: 'FPS',
      width: '幅',
      quality: '品質',
      loop: 'ループ',
      loopHint: '0 = 無限',
      estFrames: (n) => `約 ${n} フレーム`,
      tooMany: 'サイズ大・エンコード遅い',
      generate: 'アニメーション WebP を作成',
      generating: (d, t) => `フレームをエンコード中 ${d} / ${t}`,
      result: { size: 'サイズ', dimensions: '寸法', frames: 'フレーム', duration: '長さ' },
      download: 'ダウンロード',
      another: '別の動画',
      failed: '失敗',
      unsupported: 'この動画コーデックはブラウザでデコードできません。H.264 の MP4 をお試しください。',
      noVideo: 'このファイルに映像トラックが見つかりませんでした。',
      readFailed: 'このファイルを読み込めませんでした。iCloud やクラウド上にある場合は、先に端末へダウンロードしてからお試しください。',
    },
    slackEmoji: {
      title: 'Slack 絵文字メーカー',
      text: 'テキスト',
      textPlaceholder: 'LGTM',
      textHint: 'ヒント：Enter で改行できます。',
      textColor: '文字',
      bgColor: '背景',
      transparent: '背景を透明に',
      bold: '太字',
      font: 'フォント',
      download: 'PNG をダウンロード',
      note: 'Slack 推奨の 128×128 PNG で書き出します。Slack の「絵文字を追加」からアップロードしてください。',
    },
  },
};
