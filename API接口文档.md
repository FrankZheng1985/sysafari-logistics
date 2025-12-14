# 用户管理 API 接口文档

本文档描述了用户管理功能需要对接的后台 API 接口规范。

## 基础配置

所有 API 接口的基础地址通过 `window.API_BASE_URL` 配置，在 `index.html` 中设置。

## 统一响应格式

所有接口返回统一的响应格式：

```typescript
{
  errCode: number,  // 200 表示成功，其他表示错误
  msg: string,      // 响应消息
  data?: any        // 响应数据（可选）
}
```

## 接口列表

### 1. 获取用户列表

**接口地址：** `GET /api/users`

**请求参数：**
- `page` (number, 可选): 页码，默认 1
- `pageSize` (number, 可选): 每页数量，默认 10
- `search` (string, 可选): 搜索关键词（用户名、姓名、邮箱）
- `role` (string, 可选): 权限筛选（admin/operator/viewer）
- `status` (string, 可选): 状态筛选（active/inactive）

**响应示例：**
```json
{
  "errCode": 200,
  "msg": "success",
  "data": {
    "list": [
      {
        "id": "1",
        "username": "admin",
        "name": "管理员",
        "email": "admin@example.com",
        "phone": "13800138000",
        "role": "admin",
        "status": "active",
        "createTime": "2025-01-01T00:00:00.000Z",
        "updateTime": "2025-01-01T00:00:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

### 2. 创建用户

**接口地址：** `POST /api/users`

**请求体：**
```json
{
  "username": "user001",
  "name": "用户001",
  "email": "user001@example.com",
  "phone": "13800138000",
  "role": "viewer",
  "status": "active",
  "password": "password123"
}
```

**响应示例：**
```json
{
  "errCode": 200,
  "msg": "创建成功",
  "data": {
    "id": "123",
    "username": "user001",
    "name": "用户001",
    "email": "user001@example.com",
    "phone": "13800138000",
    "role": "viewer",
    "status": "active",
    "createTime": "2025-01-01T00:00:00.000Z"
  }
}
```

### 3. 更新用户信息

**接口地址：** `PUT /api/users/:id`

**路径参数：**
- `id` (string): 用户ID

**请求体：**
```json
{
  "email": "newemail@example.com",
  "phone": "13900139000",
  "role": "operator"
}
```

**响应示例：**
```json
{
  "errCode": 200,
  "msg": "更新成功",
  "data": {
    "id": "123",
    "username": "user001",
    "name": "用户001",
    "email": "newemail@example.com",
    "phone": "13900139000",
    "role": "operator",
    "status": "active",
    "updateTime": "2025-01-01T00:00:00.000Z"
  }
}
```

### 4. 删除用户

**接口地址：** `DELETE /api/users/:id`

**路径参数：**
- `id` (string): 用户ID

**响应示例：**
```json
{
  "errCode": 200,
  "msg": "删除成功"
}
```

### 5. 更新用户状态

**接口地址：** `PATCH /api/users/:id/status`

**路径参数：**
- `id` (string): 用户ID

**请求体：**
```json
{
  "status": "inactive"
}
```

**响应示例：**
```json
{
  "errCode": 200,
  "msg": "状态更新成功",
  "data": {
    "id": "123",
    "username": "user001",
    "name": "用户001",
    "email": "user001@example.com",
    "role": "viewer",
    "status": "inactive",
    "updateTime": "2025-01-01T00:00:00.000Z"
  }
}
```

### 6. 修改用户密码

**接口地址：** `PATCH /api/users/:id/password`

**路径参数：**
- `id` (string): 用户ID

**请求体：**
```json
{
  "password": "newpassword123"
}
```

**响应示例：**
```json
{
  "errCode": 200,
  "msg": "密码修改成功"
}
```

## 数据模型

### User 用户对象

```typescript
{
  id: string                    // 用户ID
  username: string              // 用户名（不可修改）
  name: string                  // 姓名
  email: string                 // 邮箱
  phone?: string                // 电话（可选）
  role: 'admin' | 'operator' | 'viewer'  // 权限
  status: 'active' | 'inactive' // 状态
  createTime?: string           // 创建时间（ISO 8601格式）
  updateTime?: string           // 更新时间（ISO 8601格式）
}
```

### 权限说明

- `admin`: 管理员，拥有所有权限
- `operator`: 操作员，可以操作业务数据
- `viewer`: 查看者，只能查看数据

### 状态说明

- `active`: 启用，用户可以正常登录和使用系统
- `inactive`: 禁用，用户无法登录系统

## 对接步骤

1. **配置 API 基础地址**
   - 在 `index.html` 中设置 `window.API_BASE_URL` 为后台系统地址
   - 例如：`window.API_BASE_URL = "http://your-backend-server/api"`

2. **修改 API 服务文件**
   - 打开 `src/utils/api.ts`
   - 找到对应的接口函数
   - 取消注释 TODO 标记的代码
   - 删除或注释掉模拟数据的代码

3. **测试接口**
   - 确保所有接口返回格式符合规范
   - 测试错误处理（如网络错误、权限错误等）

4. **错误处理**
   - 接口返回 `errCode !== 200` 时，前端会显示错误消息
   - 网络错误会显示 "网络错误，请稍后重试"

## 注意事项

1. 所有接口需要支持 CORS（跨域资源共享）
2. 建议使用 JWT Token 进行身份认证，Token 通过请求头传递
3. 密码字段在传输时应使用 HTTPS 加密
4. 用户名创建后不可修改
5. 删除用户操作建议添加二次确认（前端已实现）

## 代码位置

- API 服务文件：`src/utils/api.ts`
- 用户管理页面：`src/pages/UserManage.tsx`
- 创建用户组件：`src/components/UserCreateModal.tsx`
- 编辑用户组件：`src/components/UserEditModal.tsx`
- 修改密码组件：`src/components/UserPasswordModal.tsx`

