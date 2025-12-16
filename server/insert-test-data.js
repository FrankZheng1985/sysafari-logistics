import Database from 'better-sqlite3';
import crypto from 'crypto';
const db = new Database('./data/orders.db');

// 生成随机ID
const generateId = () => crypto.randomBytes(8).toString('hex');

// 生成提单号
const generateBillNumber = (index) => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return `BL${year}${month}${String(index).padStart(4, '0')}`;
};

// 生成集装箱号
const generateContainerNumber = (index) => {
  const prefixes = ['CCLU', 'MSCU', 'MSKU', 'CMAU', 'ONEU', 'EGHU', 'HLCU', 'YMLU'];
  const prefix = prefixes[index % prefixes.length];
  return `${prefix}${String(1000000 + index).slice(1)}0`;
};

// 测试数据
const shippers = ['深圳华美贸易有限公司', '上海远洋国际物流', '广州新世纪进出口', '宁波港通国际', '青岛海运达物流', '天津环球货运', '厦门集盛贸易', '大连北方物流'];
const consignees = ['London Trading Co.', 'Hamburg Import GmbH', 'Rotterdam Logistics BV', 'Paris Commerce SARL', 'Madrid Trading SL', 'Milan Import Srl', 'New York Cargo Inc.', 'Los Angeles Freight LLC'];
const vessels = ['EVER GIVEN', 'MSC OSCAR', 'COSCO SHIPPING UNIVERSE', 'CMA CGM MARCO POLO', 'ONE COLUMBA', 'MAERSK ELBA', 'YANGMING MILLION', 'HAPAG LLOYD EXPRESS'];
const loadingPorts = ['上海港', '宁波港', '深圳港', '青岛港', '天津港', '厦门港', '广州港', '大连港'];
const destPorts = ['鹿特丹港', '汉堡港', '安特卫普港', '费利克斯托港', '洛杉矶港', '纽约港', '横滨港', '新加坡港'];
const deliveryPlaces = ['Rotterdam Warehouse', 'Hamburg Central', 'Antwerp Depot', 'London Distribution', 'LA Container Yard', 'NYC Terminal', 'Yokohama Dock', 'Singapore Hub'];
const companies = ['中远海运', '地中海航运', '马士基', '达飞轮船', '海洋网联', '长荣海运', '赫伯罗特', '阳明海运'];

const shipStatuses = ['未到港', '已到港', '已到港', '已到港', '已到港', '跳港'];
const customsStatuses = ['未放行', '已放行', '已放行', '已放行', '已放行'];
const inspectionStatuses = ['-', '-', '待查验', '查验中', '已查验', '查验放行', '已放行'];
const deliveryStatuses = ['待派送', '待派送', '派送中', '派送中', '已送达', '订单异常'];

// 获取当前最大序号
const maxSeq = db.prepare('SELECT MAX(order_seq) as maxSeq FROM bills_of_lading').get();
let currentSeq = (maxSeq && maxSeq.maxSeq) ? maxSeq.maxSeq + 1 : 1;

const insertBill = db.prepare(`
  INSERT INTO bills_of_lading (
    id, bill_number, container_number, vessel, eta, ata, pieces, weight, volume,
    shipper, consignee, notify_party, port_of_loading, port_of_discharge, place_of_delivery,
    ship_status, customs_status, inspection, delivery_status,
    status, creator, create_time, updated_at, company_name, order_seq, transport_method
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

console.log('开始插入20条测试提单数据...\n');

for (let i = 0; i < 20; i++) {
  const id = generateId();
  const billNumber = generateBillNumber(currentSeq + i);
  const containerNumber = generateContainerNumber(i);
  const vessel = vessels[i % vessels.length] + ' V.' + (100 + i);
  
  // 生成日期
  const today = new Date();
  const etaOffset = Math.floor(Math.random() * 30) - 15;
  const eta = new Date(today.getTime() + etaOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const ata = etaOffset < 0 ? new Date(today.getTime() + (etaOffset + Math.floor(Math.random() * 3)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null;
  
  const pieces = Math.floor(Math.random() * 500) + 50;
  const weight = (pieces * (Math.random() * 20 + 5)).toFixed(2);
  const volume = (pieces * (Math.random() * 0.5 + 0.1)).toFixed(2);
  
  const shipper = shippers[i % shippers.length];
  const consignee = consignees[i % consignees.length];
  const notifyParty = consignee;
  
  const loadingPort = loadingPorts[i % loadingPorts.length];
  const destPort = destPorts[i % destPorts.length];
  const deliveryPlace = deliveryPlaces[i % deliveryPlaces.length];
  const company = companies[i % companies.length];
  
  // 根据ETA设置状态
  let shipStatus, customsStatus, inspection, deliveryStatus;
  if (etaOffset > 5) {
    shipStatus = '未到港';
    customsStatus = '未放行';
    inspection = '-';
    deliveryStatus = '待派送';
  } else if (etaOffset > 0) {
    shipStatus = '未到港';
    customsStatus = '未放行';
    inspection = '-';
    deliveryStatus = '待派送';
  } else {
    shipStatus = shipStatuses[Math.floor(Math.random() * shipStatuses.length)];
    if (shipStatus === '已到港') {
      customsStatus = customsStatuses[Math.floor(Math.random() * customsStatuses.length)];
      if (customsStatus === '已放行') {
        inspection = inspectionStatuses[Math.floor(Math.random() * inspectionStatuses.length)];
        if (inspection === '已放行' || inspection === '-') {
          deliveryStatus = deliveryStatuses[Math.floor(Math.random() * deliveryStatuses.length)];
        } else {
          deliveryStatus = '待派送';
        }
      } else {
        inspection = i % 5 === 0 ? '待查验' : '-';
        deliveryStatus = '待派送';
      }
    } else {
      customsStatus = '未放行';
      inspection = '-';
      deliveryStatus = '待派送';
    }
  }
  
  const status = '已录入';
  const creator = 'admin';
  const createTime = new Date().toISOString();
  const updateTime = createTime;
  
  insertBill.run(
    id, billNumber, containerNumber, vessel, eta, ata, pieces, weight, volume,
    shipper, consignee, notifyParty, loadingPort, destPort, deliveryPlace,
    shipStatus, customsStatus, inspection, deliveryStatus,
    status, creator, createTime, updateTime, company, currentSeq + i, '海运'
  );
  
  console.log(`  ${String(i + 1).padStart(2)}. ${billNumber} | ${shipper.padEnd(16)} | ${destPort.padEnd(10)} | 船:${shipStatus.padEnd(4)} | 清关:${customsStatus.padEnd(4)} | 查验:${inspection.padEnd(6)} | 派送:${deliveryStatus}`);
}

console.log('\n✅ 成功插入20条测试提单数据！');

// 验证
const count = db.prepare('SELECT COUNT(*) as count FROM bills_of_lading').get();
console.log(`\n当前提单总数: ${count.count}`);

db.close();

