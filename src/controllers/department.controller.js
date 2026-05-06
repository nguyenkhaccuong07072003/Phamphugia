const { Department, SubMenuItem } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { successResponse } = require('../utils/response');
const { slugify } = require('../utils/slugify');

// GET /api/admin/departments
exports.getAll = asyncHandler(async (req, res) => {
  const departments = await Department.findAll({
    include: [{
      model: SubMenuItem,
      as: 'subMenuItems',
      where: { parent_id: null },
      required: false,
      include: [{
        model: SubMenuItem,
        as: 'children',
        order: [['sort_order', 'ASC']],
      }],
    }],
    order: [
      ['sort_order', 'ASC'],
      [{ model: SubMenuItem, as: 'subMenuItems' }, 'sort_order', 'ASC'],
    ],
  });
  return successResponse(res, departments);
});

// GET /api/admin/departments/:id
exports.getById = asyncHandler(async (req, res) => {
  const department = await Department.findByPk(req.params.id, {
    include: [{
      model: SubMenuItem,
      as: 'subMenuItems',
      where: { parent_id: null },
      required: false,
      include: [{
        model: SubMenuItem,
        as: 'children',
        order: [['sort_order', 'ASC']],
      }],
    }],
    order: [
      [{ model: SubMenuItem, as: 'subMenuItems' }, 'sort_order', 'ASC'],
    ],
  });
  if (!department) throw new ApiError(404, 'Department not found');
  return successResponse(res, department);
});

// POST /api/admin/departments
exports.create = asyncHandler(async (req, res) => {
  const { name, phone, sort_order } = req.body;
  const slug = slugify(name);

  // Nếu không gửi sort_order (hoặc đang là 0 mặc định từ form)
  // → tự động lấy max(sort_order) + 1
  let sortOrder = sort_order;
  const sortOrderIsEmpty =
    sortOrder === undefined ||
    sortOrder === null ||
    sortOrder === '' ||
    Number(sortOrder) === 0;

  if (sortOrderIsEmpty) {
    const maxRow = await Department.findOne({
      attributes: [
        [Department.sequelize.fn("MAX", Department.sequelize.col("sort_order")), "maxOrder"],
      ],
    });
    const maxOrder = (maxRow && maxRow.get("maxOrder")) || 0;
    sortOrder = Number(maxOrder) + 1;
  }

  const department = await Department.create({
    name,
    slug,
    phone,
    sort_order: sortOrder,
  });

  return successResponse(res, department, 'Department created', 201);
});

// PUT /api/admin/departments/:id
exports.update = asyncHandler(async (req, res) => {
  const department = await Department.findByPk(req.params.id);
  if (!department) throw new ApiError(404, 'Department not found');

  const { name, phone, sort_order, is_active } = req.body;

  if (name !== undefined) {
    department.name = name;
    department.slug = slugify(name);
  }
  if (phone !== undefined) department.phone = phone;
  if (sort_order !== undefined) department.sort_order = sort_order;
  if (is_active !== undefined) department.is_active = is_active;

  await department.save();
  return successResponse(res, department, 'Department updated');
});

// DELETE /api/admin/departments/:id
exports.remove = asyncHandler(async (req, res) => {
  const department = await Department.findByPk(req.params.id);
  if (!department) throw new ApiError(404, 'Department not found');

  await department.destroy();
  return successResponse(res, null, 'Department deleted');
});

// --- Sub Menu Items ---

// GET /api/admin/departments/:departmentId/sub-menus
exports.getSubMenus = asyncHandler(async (req, res) => {
  const items = await SubMenuItem.findAll({
    where: { department_id: req.params.departmentId, parent_id: null },
    include: [{
      model: SubMenuItem,
      as: 'children',
      order: [['sort_order', 'ASC']],
    }],
    order: [['sort_order', 'ASC']],
  });
  return successResponse(res, items);
});

// POST /api/admin/departments/:departmentId/sub-menus
exports.createSubMenu = asyncHandler(async (req, res) => {
  const { label, href, sort_order, content, parent_id } = req.body;
  const dept = await Department.findByPk(req.params.departmentId);
  if (!dept) throw new ApiError(404, 'Department not found');

  // Validate parent_id if provided
  let parentSub = null;
  if (parent_id) {
    parentSub = await SubMenuItem.findByPk(parent_id);
    if (!parentSub) throw new ApiError(404, 'Parent sub menu not found');
    if (parentSub.parent_id) throw new ApiError(400, 'Only 2 levels of nesting allowed');
  }

  const subSlug = slugify(label);
  const generatedHref = parentSub
    ? `/page/${dept.slug}/${parentSub.slug}/${subSlug}`
    : `/page/${dept.slug}/${subSlug}`;
  const item = await SubMenuItem.create({
    department_id: req.params.departmentId,
    label,
    slug: subSlug,
    href: href || generatedHref,
    content: content || null,
    sort_order: sort_order || 0,
    parent_id: parent_id || null,
  });
  return successResponse(res, item, 'Sub menu item created', 201);
});

// PUT /api/admin/sub-menus/:id
exports.updateSubMenu = asyncHandler(async (req, res) => {
  const item = await SubMenuItem.findByPk(req.params.id);
  if (!item) throw new ApiError(404, 'Sub menu item not found');

  const { label, href, sort_order, is_active, content, parent_id } = req.body;
  if (label !== undefined) {
    item.label = label;
    const dept = await Department.findByPk(item.department_id);
    const deptSlug = dept ? dept.slug : '';
    const subSlug = slugify(label);
    item.slug = subSlug;
    if (!href || href === '#' || href.startsWith('/page/')) {
      if (item.parent_id) {
        const parentSub = await SubMenuItem.findByPk(item.parent_id);
        item.href = `/page/${deptSlug}/${parentSub ? parentSub.slug : ''}/${subSlug}`;
      } else {
        item.href = `/page/${deptSlug}/${subSlug}`;
      }
    }
  }
  if (href !== undefined && !href.startsWith('/page/')) item.href = href;
  if (sort_order !== undefined) item.sort_order = sort_order;
  if (is_active !== undefined) item.is_active = is_active;
  if (content !== undefined) item.content = content;
  if (parent_id !== undefined) {
    if (parent_id) {
      const parent = await SubMenuItem.findByPk(parent_id);
      if (!parent) throw new ApiError(404, 'Parent sub menu not found');
      if (parent.parent_id) throw new ApiError(400, 'Only 2 levels of nesting allowed');
    }
    item.parent_id = parent_id;
  }

  await item.save();
  return successResponse(res, item, 'Sub menu item updated');
});

// DELETE /api/admin/sub-menus/:id
exports.removeSubMenu = asyncHandler(async (req, res) => {
  const item = await SubMenuItem.findByPk(req.params.id);
  if (!item) throw new ApiError(404, 'Sub menu item not found');

  // Delete children first if this is a parent
  await SubMenuItem.destroy({ where: { parent_id: item.id } });
  await item.destroy();
  return successResponse(res, null, 'Sub menu item deleted');
});
