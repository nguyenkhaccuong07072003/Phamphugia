const { Company } = require("../models");
const { slugify } = require("../utils/slugify");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { successResponse } = require("../utils/response");

// GET /api/admin/companies
exports.getAll = asyncHandler(async (req, res) => {
  const companies = await Company.findAll({
    order: [["sort_order", "ASC"]],
  });
  return successResponse(res, companies);
});

// GET /api/admin/companies/:id
exports.getById = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) throw new ApiError(404, "Company not found");
  return successResponse(res, company);
});

// GET /api/public/companies
exports.getPublicList = asyncHandler(async (req, res) => {
  const companies = await Company.findAll({
    where: { is_active: true },
    // Trả thêm slug để FE dùng trong URL (?company=slug)
    attributes: ["id", "name", "slug"],
    order: [["sort_order", "ASC"]],
  });
  return successResponse(res, companies);
});

// POST /api/admin/companies
exports.create = asyncHandler(async (req, res) => {
  const { name, sort_order, slug } = req.body;

  if (!name) {
    throw new ApiError(400, "Name is required");
  }

  // Nếu không gửi slug, tự tạo từ name
  const finalSlug = slug && slug.trim() ? slugify(slug.trim()) : slugify(name);

  // Nếu không gửi sort_order (hoặc đang là 0 mặc định từ form)
  // → tự động lấy max(sort_order) + 1
  let sortOrder = sort_order;
  const sortOrderIsEmpty =
    sortOrder === undefined ||
    sortOrder === null ||
    sortOrder === '' ||
    Number(sortOrder) === 0;

  if (sortOrderIsEmpty) {
    const maxRow = await Company.findOne({
      attributes: [
        [Company.sequelize.fn("MAX", Company.sequelize.col("sort_order")), "maxOrder"],
      ],
    });
    const maxOrder = (maxRow && maxRow.get("maxOrder")) || 0;
    sortOrder = Number(maxOrder) + 1;
  }

  const company = await Company.create({
    name,
    slug: finalSlug || null,
    sort_order: sortOrder,
  });

  return successResponse(res, company, "Company created", 201);
});

// PUT /api/admin/companies/:id
exports.update = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) throw new ApiError(404, "Company not found");

  const { name, sort_order, is_active, slug } = req.body;

  if (name !== undefined) company.name = name;
  if (sort_order !== undefined) company.sort_order = sort_order;
  if (is_active !== undefined) company.is_active = is_active;

  // Cập nhật slug:
  // - Nếu client gửi slug -> ưu tiên, slugify lại
  // - Nếu không gửi slug nhưng đổi name và hiện tại slug đang null/empty -> tự sinh mới
  if (slug !== undefined) {
    const s = slug.trim();
    company.slug = s ? slugify(s) : null;
  } else if (name !== undefined && (!company.slug || !company.slug.trim())) {
    const auto = slugify(name);
    if (auto) company.slug = auto;
  }

  await company.save();
  return successResponse(res, company, "Company updated");
});

// DELETE /api/admin/companies/:id
exports.delete = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) throw new ApiError(404, "Company not found");

  await company.destroy();
  return successResponse(res, null, "Company deleted");
});
