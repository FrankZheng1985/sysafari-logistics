import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// 中国主要卡车运输港数据
const truckPorts = [
  // 广东省主要城市
  { 
    portCode: 'CNGZHT', 
    portNameCn: '广州卡车港', 
    portNameEn: 'Guangzhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '广州', 
    description: '广东省会，华南地区重要物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNSZNT', 
    portNameCn: '深圳卡车港', 
    portNameEn: 'Shenzhen Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '深圳', 
    description: '经济特区，华南重要物流中心', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNDGDT', 
    portNameCn: '东莞卡车港', 
    portNameEn: 'Dongguan Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '东莞', 
    description: '制造业重镇，重要物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNFOST', 
    portNameCn: '佛山卡车港', 
    portNameEn: 'Foshan Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '佛山', 
    description: '制造业基地，重要物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNZQHT', 
    portNameCn: '珠海卡车港', 
    portNameEn: 'Zhuhai Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '珠海', 
    description: '经济特区，珠三角重要物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNZST', 
    portNameCn: '中山卡车港', 
    portNameEn: 'Zhongshan Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '中山', 
    description: '珠三角重要制造业城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNHUIT', 
    portNameCn: '惠州卡车港', 
    portNameEn: 'Huizhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '惠州', 
    description: '珠三角重要工业城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNJMT', 
    portNameCn: '江门卡车港', 
    portNameEn: 'Jiangmen Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '江门', 
    description: '珠三角重要物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 上海
  { 
    portCode: 'CNSHAT', 
    portNameCn: '上海卡车港', 
    portNameEn: 'Shanghai Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '上海', 
    description: '中国最大经济中心，重要物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 浙江省主要城市
  { 
    portCode: 'CNHZGT', 
    portNameCn: '杭州卡车港', 
    portNameEn: 'Hangzhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '杭州', 
    description: '浙江省会，长三角重要物流中心', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNNGBT', 
    portNameCn: '宁波卡车港', 
    portNameEn: 'Ningbo Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '宁波', 
    description: '重要港口城市，长三角物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNWZHT', 
    portNameCn: '温州卡车港', 
    portNameEn: 'Wenzhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '温州', 
    description: '重要制造业城市，浙南物流中心', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNJXHT', 
    portNameCn: '嘉兴卡车港', 
    portNameEn: 'Jiaxing Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '嘉兴', 
    description: '长三角重要物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNHZHT', 
    portNameCn: '湖州卡车港', 
    portNameEn: 'Huzhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '湖州', 
    description: '长三角重要物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNSXGT', 
    portNameCn: '绍兴卡车港', 
    portNameEn: 'Shaoxing Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '绍兴', 
    description: '重要制造业城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNJHT', 
    portNameCn: '金华卡车港', 
    portNameEn: 'Jinhua Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '金华', 
    description: '重要物流枢纽城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNTZHT', 
    portNameCn: '台州卡车港', 
    portNameEn: 'Taizhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '台州', 
    description: '重要制造业城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 山东省主要城市
  { 
    portCode: 'CNJNAT', 
    portNameCn: '济南卡车港', 
    portNameEn: 'Jinan Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '济南', 
    description: '山东省会，华北重要物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNQDT', 
    portNameCn: '青岛卡车港', 
    portNameEn: 'Qingdao Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '青岛', 
    description: '重要港口城市，华北物流中心', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNYNT', 
    portNameCn: '烟台卡车港', 
    portNameEn: 'Yantai Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '烟台', 
    description: '重要港口城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNWFT', 
    portNameCn: '潍坊卡车港', 
    portNameEn: 'Weifang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '潍坊', 
    description: '重要制造业城市，物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNLYGT', 
    portNameCn: '临沂卡车港', 
    portNameEn: 'Linyi Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '临沂', 
    description: '重要商贸物流城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNZBT', 
    portNameCn: '淄博卡车港', 
    portNameEn: 'Zibo Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '淄博', 
    description: '重要工业城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNJNNT', 
    portNameCn: '济宁卡车港', 
    portNameEn: 'Jining Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '济宁', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNTAT', 
    portNameCn: '泰安卡车港', 
    portNameEn: 'Tai\'an Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '泰安', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNWHT', 
    portNameCn: '威海卡车港', 
    portNameEn: 'Weihai Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '威海', 
    description: '重要港口城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNRZHT', 
    portNameCn: '日照卡车港', 
    portNameEn: 'Rizhao Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '日照', 
    description: '重要港口城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 江西省主要城市
  { 
    portCode: 'CNNCHT', 
    portNameCn: '南昌卡车港', 
    portNameEn: 'Nanchang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '南昌', 
    description: '江西省会，中部重要物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNJDT', 
    portNameCn: '景德镇卡车港', 
    portNameEn: 'Jingdezhen Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '景德镇', 
    description: '重要制造业城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNPXT', 
    portNameCn: '萍乡卡车港', 
    portNameEn: 'Pingxiang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '萍乡', 
    description: '重要工业城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNJJT', 
    portNameCn: '九江卡车港', 
    portNameEn: 'Jiujiang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '九江', 
    description: '重要港口城市，物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNXYT', 
    portNameCn: '新余卡车港', 
    portNameEn: 'Xinyu Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '新余', 
    description: '重要工业城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNYCT', 
    portNameCn: '鹰潭卡车港', 
    portNameEn: 'Yingtan Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '鹰潭', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNGZT', 
    portNameCn: '赣州卡车港', 
    portNameEn: 'Ganzhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '赣州', 
    description: '重要物流枢纽城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNJAT', 
    portNameCn: '吉安卡车港', 
    portNameEn: 'Ji\'an Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '吉安', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNYFT', 
    portNameCn: '宜春卡车港', 
    portNameEn: 'Yichun Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '宜春', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNFZT', 
    portNameCn: '抚州卡车港', 
    portNameEn: 'Fuzhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '抚州', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNSRT', 
    portNameCn: '上饶卡车港', 
    portNameEn: 'Shangrao Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '上饶', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 新疆主要城市
  { 
    portCode: 'CNURCT', 
    portNameCn: '乌鲁木齐卡车港', 
    portNameEn: 'Urumqi Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '乌鲁木齐', 
    description: '新疆首府，西北重要物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNKLT', 
    portNameCn: '克拉玛依卡车港', 
    portNameEn: 'Karamay Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '克拉玛依', 
    description: '重要石油城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNTST', 
    portNameCn: '吐鲁番卡车港', 
    portNameEn: 'Turpan Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '吐鲁番', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNHMT', 
    portNameCn: '哈密卡车港', 
    portNameEn: 'Hami Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '哈密', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNKST', 
    portNameCn: '喀什卡车港', 
    portNameEn: 'Kashgar Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '喀什', 
    description: '南疆重要物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNAKT', 
    portNameCn: '阿克苏卡车港', 
    portNameEn: 'Aksu Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '阿克苏', 
    description: '南疆重要物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNKRT', 
    portNameCn: '库尔勒卡车港', 
    portNameEn: 'Korla Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '库尔勒', 
    description: '南疆重要物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNALT', 
    portNameCn: '阿拉尔卡车港', 
    portNameEn: 'Aral Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '阿拉尔', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 福建省主要城市
  { 
    portCode: 'CNFZOT', 
    portNameCn: '福州卡车港', 
    portNameEn: 'Fuzhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '福州', 
    description: '福建省会，东南重要物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNXMNT', 
    portNameCn: '厦门卡车港', 
    portNameEn: 'Xiamen Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '厦门', 
    description: '经济特区，重要港口城市，物流中心', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNPUT', 
    portNameCn: '莆田卡车港', 
    portNameEn: 'Putian Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '莆田', 
    description: '重要制造业城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNQZT', 
    portNameCn: '泉州卡车港', 
    portNameEn: 'Quanzhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '泉州', 
    description: '重要制造业城市，物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNZZT', 
    portNameCn: '漳州卡车港', 
    portNameEn: 'Zhangzhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '漳州', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNLYNT', 
    portNameCn: '龙岩卡车港', 
    portNameEn: 'Longyan Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '龙岩', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNNDT', 
    portNameCn: '宁德卡车港', 
    portNameEn: 'Ningde Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '宁德', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNSMT', 
    portNameCn: '三明卡车港', 
    portNameEn: 'Sanming Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '三明', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNNPT', 
    portNameCn: '南平卡车港', 
    portNameEn: 'Nanping Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '南平', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 河北省主要城市
  { 
    portCode: 'CNSJWT', 
    portNameCn: '石家庄卡车港', 
    portNameEn: 'Shijiazhuang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '石家庄', 
    description: '河北省会，华北重要物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNTSHT', 
    portNameCn: '唐山卡车港', 
    portNameEn: 'Tangshan Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '唐山', 
    description: '重要工业城市，物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNQHDT', 
    portNameCn: '秦皇岛卡车港', 
    portNameEn: 'Qinhuangdao Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '秦皇岛', 
    description: '重要港口城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNHDT', 
    portNameCn: '邯郸卡车港', 
    portNameEn: 'Handan Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '邯郸', 
    description: '重要工业城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNXTT', 
    portNameCn: '邢台卡车港', 
    portNameEn: 'Xingtai Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '邢台', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNBDT', 
    portNameCn: '保定卡车港', 
    portNameEn: 'Baoding Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '保定', 
    description: '重要物流枢纽城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNZJKT', 
    portNameCn: '张家口卡车港', 
    portNameEn: 'Zhangjiakou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '张家口', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNCDT', 
    portNameCn: '承德卡车港', 
    portNameEn: 'Chengde Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '承德', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNLFT', 
    portNameCn: '廊坊卡车港', 
    portNameEn: 'Langfang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '廊坊', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNHST', 
    portNameCn: '衡水卡车港', 
    portNameEn: 'Hengshui Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '衡水', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNCZHT', 
    portNameCn: '沧州卡车港', 
    portNameEn: 'Cangzhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '沧州', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 河南省主要城市
  { 
    portCode: 'CNZZHT', 
    portNameCn: '郑州卡车港', 
    portNameEn: 'Zhengzhou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '郑州', 
    description: '河南省会，中部重要物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNLYYT', 
    portNameCn: '洛阳卡车港', 
    portNameEn: 'Luoyang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '洛阳', 
    description: '重要工业城市，物流枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNKFT', 
    portNameCn: '开封卡车港', 
    portNameEn: 'Kaifeng Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '开封', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNPDS', 
    portNameCn: '平顶山卡车港', 
    portNameEn: 'Pingdingshan Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '平顶山', 
    description: '重要工业城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNANT', 
    portNameCn: '安阳卡车港', 
    portNameEn: 'Anyang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '安阳', 
    description: '重要工业城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNHBT', 
    portNameCn: '鹤壁卡车港', 
    portNameEn: 'Hebi Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '鹤壁', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNXINT', 
    portNameCn: '新乡卡车港', 
    portNameEn: 'Xinxiang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '新乡', 
    description: '重要物流枢纽城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNJZT', 
    portNameCn: '焦作卡车港', 
    portNameEn: 'Jiaozuo Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '焦作', 
    description: '重要工业城市，物流节点', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNPYT', 
    portNameCn: '濮阳卡车港', 
    portNameEn: 'Puyang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '濮阳', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNXCT', 
    portNameCn: '许昌卡车港', 
    portNameEn: 'Xuchang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '许昌', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNLHT', 
    portNameCn: '漯河卡车港', 
    portNameEn: 'Luohe Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '漯河', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNSMXT', 
    portNameCn: '三门峡卡车港', 
    portNameEn: 'Sanmenxia Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '三门峡', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNNYT', 
    portNameCn: '南阳卡车港', 
    portNameEn: 'Nanyang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '南阳', 
    description: '重要物流枢纽城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNSQT', 
    portNameCn: '商丘卡车港', 
    portNameEn: 'Shangqiu Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '商丘', 
    description: '重要物流枢纽城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNXYAT', 
    portNameCn: '信阳卡车港', 
    portNameEn: 'Xinyang Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '信阳', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNZKT', 
    portNameCn: '周口卡车港', 
    portNameEn: 'Zhoukou Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '周口', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNZMDT', 
    portNameCn: '驻马店卡车港', 
    portNameEn: 'Zhumadian Truck Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '驻马店', 
    description: '重要物流节点城市', 
    portType: 'main', 
    parentPortCode: null 
  },
]

console.log('🚛 开始初始化中国卡车运输港数据...')

try {
  // 清空现有卡车运输港数据
  console.log('🗑️  清空现有卡车运输港数据...')
  const deleteStmt = db.prepare("DELETE FROM ports_of_loading WHERE transport_type = 'truck'")
  const deleteResult = deleteStmt.run()
  console.log(`   已删除 ${deleteResult.changes} 条旧数据`)

  // 插入新数据
  console.log('📝 开始插入卡车运输港数据...')
  const insertStmt = db.prepare(`
    INSERT INTO ports_of_loading (
      port_code, 
      port_name_cn, 
      port_name_en, 
      country, 
      country_code, 
      city, 
      description, 
      transport_type, 
      port_type, 
      parent_port_code, 
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'truck', ?, ?, 'active')
  `)

  let insertedCount = 0
  for (const port of truckPorts) {
    try {
      insertStmt.run(
        port.portCode,
        port.portNameCn,
        port.portNameEn,
        port.country,
        port.countryCode,
        port.city,
        port.description,
        port.portType,
        port.parentPortCode || null
      )
      insertedCount++
    } catch (err) {
      console.error(`   插入失败: ${port.portNameCn} (${port.portCode})`, err.message)
    }
  }

  console.log(`✅ 成功导入 ${insertedCount} 条卡车运输港数据`)

  // 统计信息
  const mainPorts = truckPorts.filter(p => p.portType === 'main').length
  console.log(`📊 主卡车港: ${mainPorts} 个`)

  // 按省份/地区统计
  const provinceStats = {
    '广东省': truckPorts.filter(p => ['广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州', '江门'].includes(p.city)).length,
    '上海': truckPorts.filter(p => p.city === '上海').length,
    '浙江省': truckPorts.filter(p => ['杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '台州'].includes(p.city)).length,
    '山东省': truckPorts.filter(p => ['济南', '青岛', '烟台', '潍坊', '临沂', '淄博', '济宁', '泰安', '威海', '日照'].includes(p.city)).length,
    '江西省': truckPorts.filter(p => ['南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶'].includes(p.city)).length,
    '新疆': truckPorts.filter(p => ['乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '喀什', '阿克苏', '库尔勒', '阿拉尔'].includes(p.city)).length,
    '福建省': truckPorts.filter(p => ['福州', '厦门', '莆田', '泉州', '漳州', '龙岩', '宁德', '三明', '南平'].includes(p.city)).length,
    '河北省': truckPorts.filter(p => ['石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '廊坊', '衡水', '沧州'].includes(p.city)).length,
    '河南省': truckPorts.filter(p => ['郑州', '洛阳', '开封', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店'].includes(p.city)).length,
  }

  console.log('\n📈 按省份/地区统计:')
  Object.entries(provinceStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([province, count]) => {
      console.log(`   ${province}: ${count} 个卡车港`)
    })

  console.log('\n✅ 数据库操作完成')
} catch (error) {
  console.error('❌ 初始化失败:', error)
  process.exit(1)
} finally {
  db.close()
}

