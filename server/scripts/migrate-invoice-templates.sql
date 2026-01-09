-- 发票模板管理表
-- 用于存储多语言发票模板配置
-- 创建日期: 2026-01-09

-- 创建发票模板表
CREATE TABLE IF NOT EXISTS invoice_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  languages JSONB DEFAULT '["zh", "en"]'::jsonb,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_invoice_templates_is_default ON invoice_templates(is_default) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_invoice_templates_is_deleted ON invoice_templates(is_deleted);

-- 添加注释
COMMENT ON TABLE invoice_templates IS '发票模板表 - 存储多语言发票模板配置';
COMMENT ON COLUMN invoice_templates.template_name IS '模板名称';
COMMENT ON COLUMN invoice_templates.is_default IS '是否为默认模板';
COMMENT ON COLUMN invoice_templates.languages IS '支持的语言列表，如 ["zh", "en", "de"]';
COMMENT ON COLUMN invoice_templates.content IS '模板内容，按语言存储，如 {"zh": {...}, "en": {...}}';
COMMENT ON COLUMN invoice_templates.is_deleted IS '软删除标记';

-- 插入默认模板数据
INSERT INTO invoice_templates (template_name, is_default, languages, content) 
VALUES (
  '默认发票模板',
  true,
  '["zh", "en"]'::jsonb,
  '{
    "zh": {
      "companyName": "",
      "companyAddress": "",
      "companyCity": "",
      "companyCountry": "",
      "companyPostcode": "",
      "companyPhone": "",
      "companyEmail": "",
      "companyWebsite": "",
      "taxNumber": "",
      "registrationNumber": "",
      "bankName": "",
      "bankAddress": "",
      "accountName": "",
      "accountNumber": "",
      "swiftCode": "",
      "sortCode": "",
      "paymentTerms": "请于发票日期起30天内付款",
      "footerNote": "",
      "thankYouMessage": "感谢您的惠顾！",
      "labelInvoice": "发票",
      "labelInvoiceNumber": "发票号",
      "labelDate": "日期",
      "labelDueDate": "到期日",
      "labelBillTo": "收票方",
      "labelDescription": "描述",
      "labelQuantity": "数量",
      "labelUnitPrice": "单价",
      "labelAmount": "金额",
      "labelSubtotal": "小计",
      "labelTax": "税额",
      "labelTotal": "总计",
      "labelBankDetails": "银行信息",
      "labelPaymentTerms": "付款条款"
    },
    "en": {
      "companyName": "",
      "companyAddress": "",
      "companyCity": "",
      "companyCountry": "",
      "companyPostcode": "",
      "companyPhone": "",
      "companyEmail": "",
      "companyWebsite": "",
      "taxNumber": "",
      "registrationNumber": "",
      "bankName": "",
      "bankAddress": "",
      "accountName": "",
      "accountNumber": "",
      "swiftCode": "",
      "sortCode": "",
      "paymentTerms": "Payment due within 30 days of invoice date",
      "footerNote": "",
      "thankYouMessage": "Thank you for your business!",
      "labelInvoice": "INVOICE",
      "labelInvoiceNumber": "Invoice No.",
      "labelDate": "Date",
      "labelDueDate": "Due Date",
      "labelBillTo": "Bill To",
      "labelDescription": "Description",
      "labelQuantity": "Qty",
      "labelUnitPrice": "Unit Price",
      "labelAmount": "Amount",
      "labelSubtotal": "Subtotal",
      "labelTax": "Tax",
      "labelTotal": "Total",
      "labelBankDetails": "Bank Details",
      "labelPaymentTerms": "Payment Terms"
    }
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- 验证创建结果
SELECT 'invoice_templates 表已创建并初始化' as status;
SELECT COUNT(*) as template_count FROM invoice_templates;
