/**
 * Seed tin tức mẫu: 25 tin thường + 5 slider + 4 nổi bật (tổng 34 bài).
 *
 * Yêu cầu: có ít nhất một user (vd. npm run db:add-admin).
 *
 *   cd phamphugia-be
 *   node scripts/seed-sample-news.js
 *
 * Tuỳ chọn:
 *   $env:SEED_NEWS_AUTHOR_EMAIL="admin@phamphugia.vn"
 */

require("../src/loadEnv");

const { NewsArticle, NewsCategory, User, sequelize } = require("../src/models");
const { slugify } = require("../src/utils/slugify");

async function ensureCategory(name, slug, sortOrder) {
  const [row] = await NewsCategory.findOrCreate({
    where: { slug },
    defaults: { name, sort_order: sortOrder, is_active: true },
  });
  return row;
}

async function uniqueSlug(baseTitle) {
  let slug = slugify(baseTitle);
  if (!slug) slug = `tin-${Date.now()}`;
  const existing = await NewsArticle.findOne({ where: { slug } });
  if (existing) return `${slug}-${Date.now()}`;
  return slug;
}

function html(seed) {
  return `<p>${seed}</p><p><em>Nội dung mẫu phục vụ demo — có thể xóa hoặc chỉnh trong trang quản trị.</em></p>`;
}

/** 25 tin: chỉ hiển thị dạng tin thường (không slider, không nổi bật). */
const NORMAL_25 = [
  [
    "Thông báo nghỉ lễ Giỗ Tổ Hùng Vương",
    "Phòng HCNS thông báo lịch nghỉ và ca trực theo quy định nhà nước.",
  ],
  [
    "Cập nhật địa chỉ gửi hồ sơ nhân sự",
    "Vui lòng gửi bản cứng về bộ phận tiếp nhận tại quầy lễ tân tầng 1.",
  ],
  [
    "Hướng dẫn khai báo thuế TNCN năm hiện hành",
    "Nhân viên xem hướng dẫn đính kèm và hoàn tất trước hạn.",
  ],
  [
    "Lịch trực IT trong tuần",
    "Hotline hỗ trợ nội bộ được cập nhật trên danh bạ.",
  ],
  [
    "Khóa học an toàn thông tin bắt buộc",
    "Toàn bộ nhân viên hoàn thành bài kiểm tra trực tuyến trong tháng.",
  ],
  [
    "Quy định đặt phòng họp và hủy lịch",
    "Đặt phòng qua hệ thống; hủy trước ít nhất 2 giờ.",
  ],
  [
    "Đăng ký vé xe tháng tại bãi công ty",
    "Ưu tiên đăng ký trước ngày 25 hàng tháng.",
  ],
  [
    "Thông báo tuyển dụng một số vị trí nội bộ",
    "Ứng viên nội bộ gửi CV qua email HCNS.",
  ],
  [
    "Cập nhật danh bạ điện thoại nội bộ",
    "Phiên bản mới có mã nhánh và máy lẻ mới.",
  ],
  [
    "Khảo sát cải thiện chất lượng suất ăn ca",
    "Mời anh chị dành 2 phút điền biểu mẫu ẩn danh.",
  ],
  [
    "Nhắc nhở sao lưu tài liệu làm việc",
    "Không lưu tài liệu quan trọng chỉ trên máy cá nhân.",
  ],
  [
    "Quy định trang phục trong tuần",
    "Áp dụng từ tuần sau; chi tiết theo văn bản đính kèm.",
  ],
  [
    "Lịch bảo trì hệ thống điều hòa",
    "Một số khu vực có thể tạm ngắt trong giờ hành chính.",
  ],
  [
    "Hội thảo sức khỏe nghề nghiệp",
    "Đăng ký tham dự tại link nội bộ trước ngày giới hạn.",
  ],
  [
    "Thông báo cúp điện kế hoạch khu vực",
    "Phòng kỹ thuật thông báo khung giờ và phương án dự phòng.",
  ],
  [
    "Chương trình thi đua lao động quý",
    "Tiêu chí đánh giá và phần thưởng theo quy chế.",
  ],
  [
    "Cập nhật mẫu chữ ký email công ty",
    "Vui lòng áp dụng thống nhất từ ngày hiệu lực.",
  ],
  [
    "Hướng dẫn kết nối VPN làm việc từ xa",
    "Chỉ sử dụng tài khoản được cấp; không chia sẻ mật khẩu.",
  ],
  [
    "Danh sách cán bộ đi công tác tuần tới",
    "Liên hệ thư ký phòng khi cần điều chỉnh lịch.",
  ],
  [
    "Thông báo họp giao ban Ban Giám đốc",
    "Nội dung: triển khai nghị quyết và kế hoạch tháng.",
  ],
  [
    "Sắp xếp lại chỗ ngồi khu vực làm việc chung",
    "Bản đồ chỗ ngồi gửi qua email bộ phận.",
  ],
  [
    "Thư cảm ơn đối tác và khách hàng",
    "Ban lãnh đạo gửi lời cảm ơn vì sự đồng hành.",
  ],
  [
    "Điều chỉnh ca làm việc bộ phận sản xuất",
    "Áp dụng theo bảng phân ca đính kèm.",
  ],
  [
    "Diễn tập phòng cháy chữa cháy định kỳ",
    "Toàn bộ nhân viên tham gia theo khu vực được phân.",
  ],
  [
    "Tổng kết hoạt động Đoàn thanh niên năm",
    "Khen thưởng tập thể và cá nhân xuất sắc.",
  ],
];

/** 5 tin slider (thứ tự 1–5). */
const SLIDER_5 = [
  [
    "Chào mừng năm mới cùng phamphugia",
    "Những thành tựu đạt được và lời chúc đến toàn thể CBCNV.",
  ],
  [
    "Dự án xanh – hành động nhỏ mỗi ngày",
    "Tiết kiệm điện, giảm rác thải nhựa tại văn phòng.",
  ],
  [
    "Gặp gỡ Ban lãnh đạo: định hướng phát triển",
    "Buổi đối thoại mở với nhân viên các khối.",
  ],
  [
    "Triển lãm sản phẩm và dịch vụ nội bộ",
    "Cơ hội giao lưu giữa các phòng ban.",
  ],
  [
    "Chương trình hiến máu nhân đạo",
    "Đăng ký tham gia tại y tế công ty trong tuần.",
  ],
];

/** 4 tin nổi bật. */
const HIGHLIGHT_4 = [
  [
    "Thông điệp từ Ban lãnh đạo về năm làm việc mới",
    "Đồng hành, đổi mới và phát triển bền vững.",
  ],
  [
    "Chính sách làm việc linh hoạt áp dụng thí điểm",
    "Chi tiết điều kiện và thủ tục đăng ký.",
  ],
  [
    "Kết quả kinh doanh quý vượt chỉ tiêu",
    "Cảm ơn sự nỗ lực của toàn thể nhân viên.",
  ],
  [
    "Ra mắt cổng thông tin nội bộ phiên bản mới",
    "Giao diện thân thiện, tải nhanh và bảo mật hơn.",
  ],
];

async function main() {
  const authorEmail = process.env.SEED_NEWS_AUTHOR_EMAIL?.trim().toLowerCase();
  let author = authorEmail
    ? await User.findOne({ where: { email: authorEmail, is_active: true } })
    : null;
  if (!author) {
    author = await User.findOne({
      where: { is_active: true },
      order: [["id", "ASC"]],
    });
  }
  if (!author) {
    console.error("Không tìm thấy user nào. Chạy trước: npm run db:add-admin");
    process.exit(1);
  }

  const cat1 = await ensureCategory("Tin nội bộ", "tin-noi-bo", 1);
  const cat2 = await ensureCategory("Sự kiện", "su-kien", 2);
  const cat3 = await ensureCategory("Thông báo", "thong-bao", 3);
  const categories = [cat1, cat2, cat3];

  const baseTime = Date.now();
  let idx = 0;

  async function createOne({
    title,
    lead,
    is_normal,
    is_slider,
    is_highlight,
    slider_sort_order,
    is_pinned,
    categoryIndex,
  }) {
    const slug = await uniqueSlug(title);
    const published_at = new Date(baseTime - idx * 60 * 1000);
    idx += 1;
    const cat = categories[categoryIndex % categories.length];
    await NewsArticle.create({
      title,
      slug,
      content: html(lead),
      thumbnail_url: null,
      category_id: cat.id,
      department_id: null,
      author_id: author.id,
      is_normal,
      is_highlight,
      is_slider,
      slider_sort_order: slider_sort_order ?? 0,
      is_published: true,
      is_pinned: is_pinned ?? false,
      published_at,
      view_count: 0,
    });
  }

  for (const [title, lead] of NORMAL_25) {
    await createOne({
      title,
      lead,
      is_normal: true,
      is_slider: false,
      is_highlight: false,
      categoryIndex: idx,
    });
  }

  let sliderOrder = 1;
  for (const [title, lead] of SLIDER_5) {
    await createOne({
      title,
      lead,
      is_normal: true,
      is_slider: true,
      is_highlight: false,
      slider_sort_order: sliderOrder,
      categoryIndex: idx,
    });
    sliderOrder += 1;
  }

  for (const [title, lead] of HIGHLIGHT_4) {
    await createOne({
      title,
      lead,
      is_normal: true,
      is_slider: false,
      is_highlight: true,
      categoryIndex: idx,
    });
  }

  const total = NORMAL_25.length + SLIDER_5.length + HIGHLIGHT_4.length;
  console.log(
    `Đã tạo ${total} bài: ${NORMAL_25.length} tin thường, ${SLIDER_5.length} slider, ${HIGHLIGHT_4.length} nổi bật.`,
  );
  console.log(`Tác giả: ${author.email} (id ${author.id})`);
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
