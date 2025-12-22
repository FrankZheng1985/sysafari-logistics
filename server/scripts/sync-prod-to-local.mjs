import pg from 'pg';

const PROD_URL = 'postgresql://logistics_production_db_iv4r_user:0DcEcyjLIABWFuGNroV2mfFvLCyXP5NB@dpg-d4vmk8pr0fns739omrrg-a.virginia-postgres.render.com/logistics_production_db_iv4r?sslmode=require';
const LOCAL_URL = 'postgresql://fengzheng@localhost:5432/logistics_dev';

async function syncData() {
  const prodPool = new pg.Pool({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });
  const localPool = new pg.Pool({ connectionString: LOCAL_URL, ssl: false });
  
  try {
    console.log('🔗 连接数据库...');
    const prodClient = await prodPool.connect();
    const localClient = await localPool.connect();
    console.log('✅ 数据库连接成功\n');
    
    // 需要同步的核心业务表（按依赖顺序）
    const coreTables = [
      'countries', 'cities', 'air_ports', 'ports_of_loading', 'destination_ports',
      'shipping_companies', 'container_codes', 'transport_methods',
      'customers', 'customer_tax_numbers', 'customer_addresses',
      'suppliers', 'service_providers',
      'products', 'product_fee_items', 'service_fee_categories', 'service_fees',
      'tariff_rates', 'vat_rates',
      'users', 'roles', 'permissions', 'role_permissions',
      'order_sequences',
      'bills_of_lading', 'fees', 'import_records', 'cargo_items',
      'last_mile_carriers', 'last_mile_orders',
      'quotations', 'contracts', 'invoices',
      'documents', 'operation_logs',
      'system_settings', 'api_integrations', 'alert_rules',
      'shared_tax_numbers'
    ];
    
    console.log('📊 开始同步核心业务数据...\n');
    
    for (const tableName of coreTables) {
      try {
        // 检查表是否存在于生产数据库
        const exists = await prodClient.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
          [tableName]
        );
        if (!exists.rows[0].exists) continue;
        
        // 获取数据
        const data = await prodClient.query(`SELECT * FROM "${tableName}"`);
        if (data.rows.length === 0) continue;
        
        // 检查本地表是否存在
        const localExists = await localClient.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
          [tableName]
        );
        if (!localExists.rows[0].exists) {
          console.log(`⚠️  ${tableName}: 本地表不存在，跳过`);
          continue;
        }
        
        // 清空本地表（禁用触发器）
        await localClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
        
        // 获取列名
        const columns = Object.keys(data.rows[0]);
        
        // 批量插入
        let insertedCount = 0;
        for (const row of data.rows) {
          const values = columns.map(col => row[col]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const colNames = columns.map(c => `"${c}"`).join(', ');
          
          try {
            await localClient.query(
              `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`,
              values
            );
            insertedCount++;
          } catch (e) {
            // 忽略单条插入错误
          }
        }
        
        console.log(`✅ ${tableName}: ${insertedCount}/${data.rows.length} 条`);
      } catch (error) {
        console.log(`❌ ${tableName}: ${error.message.substring(0, 60)}`);
      }
    }
    
    console.log('\n🎉 数据同步完成！');
    
    prodClient.release();
    localClient.release();
  } catch (error) {
    console.error('❌ 同步错误:', error.message);
  } finally {
    await prodPool.end();
    await localPool.end();
  }
}

syncData();
