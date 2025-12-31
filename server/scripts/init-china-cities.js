/**
 * 中国城市数据初始化脚本
 * 包含省、市、区三级行政区划，以及拼音和邮编数据
 * 
 * 使用方法: node server/scripts/init-china-cities.js
 */

import { getDatabase } from '../config/database.js'

// 中国省级行政区数据 (level=1)
const provinces = [
  { cityNameCn: '北京市', cityNameEn: 'Beijing', cityNamePinyin: 'Beijing', postalCode: '100000', cityCode: 'BJ' },
  { cityNameCn: '天津市', cityNameEn: 'Tianjin', cityNamePinyin: 'Tianjin', postalCode: '300000', cityCode: 'TJ' },
  { cityNameCn: '上海市', cityNameEn: 'Shanghai', cityNamePinyin: 'Shanghai', postalCode: '200000', cityCode: 'SH' },
  { cityNameCn: '重庆市', cityNameEn: 'Chongqing', cityNamePinyin: 'Chongqing', postalCode: '400000', cityCode: 'CQ' },
  { cityNameCn: '河北省', cityNameEn: 'Hebei', cityNamePinyin: 'Hebei', postalCode: '050000', cityCode: 'HE' },
  { cityNameCn: '山西省', cityNameEn: 'Shanxi', cityNamePinyin: 'Shanxi', postalCode: '030000', cityCode: 'SX' },
  { cityNameCn: '辽宁省', cityNameEn: 'Liaoning', cityNamePinyin: 'Liaoning', postalCode: '110000', cityCode: 'LN' },
  { cityNameCn: '吉林省', cityNameEn: 'Jilin', cityNamePinyin: 'Jilin', postalCode: '130000', cityCode: 'JL' },
  { cityNameCn: '黑龙江省', cityNameEn: 'Heilongjiang', cityNamePinyin: 'Heilongjiang', postalCode: '150000', cityCode: 'HL' },
  { cityNameCn: '江苏省', cityNameEn: 'Jiangsu', cityNamePinyin: 'Jiangsu', postalCode: '210000', cityCode: 'JS' },
  { cityNameCn: '浙江省', cityNameEn: 'Zhejiang', cityNamePinyin: 'Zhejiang', postalCode: '310000', cityCode: 'ZJ' },
  { cityNameCn: '安徽省', cityNameEn: 'Anhui', cityNamePinyin: 'Anhui', postalCode: '230000', cityCode: 'AH' },
  { cityNameCn: '福建省', cityNameEn: 'Fujian', cityNamePinyin: 'Fujian', postalCode: '350000', cityCode: 'FJ' },
  { cityNameCn: '江西省', cityNameEn: 'Jiangxi', cityNamePinyin: 'Jiangxi', postalCode: '330000', cityCode: 'JX' },
  { cityNameCn: '山东省', cityNameEn: 'Shandong', cityNamePinyin: 'Shandong', postalCode: '250000', cityCode: 'SD' },
  { cityNameCn: '河南省', cityNameEn: 'Henan', cityNamePinyin: 'Henan', postalCode: '450000', cityCode: 'HA' },
  { cityNameCn: '湖北省', cityNameEn: 'Hubei', cityNamePinyin: 'Hubei', postalCode: '430000', cityCode: 'HB' },
  { cityNameCn: '湖南省', cityNameEn: 'Hunan', cityNamePinyin: 'Hunan', postalCode: '410000', cityCode: 'HN' },
  { cityNameCn: '广东省', cityNameEn: 'Guangdong', cityNamePinyin: 'Guangdong', postalCode: '510000', cityCode: 'GD' },
  { cityNameCn: '海南省', cityNameEn: 'Hainan', cityNamePinyin: 'Hainan', postalCode: '570000', cityCode: 'HI' },
  { cityNameCn: '四川省', cityNameEn: 'Sichuan', cityNamePinyin: 'Sichuan', postalCode: '610000', cityCode: 'SC' },
  { cityNameCn: '贵州省', cityNameEn: 'Guizhou', cityNamePinyin: 'Guizhou', postalCode: '550000', cityCode: 'GZ' },
  { cityNameCn: '云南省', cityNameEn: 'Yunnan', cityNamePinyin: 'Yunnan', postalCode: '650000', cityCode: 'YN' },
  { cityNameCn: '陕西省', cityNameEn: 'Shaanxi', cityNamePinyin: 'Shaanxi', postalCode: '710000', cityCode: 'SN' },
  { cityNameCn: '甘肃省', cityNameEn: 'Gansu', cityNamePinyin: 'Gansu', postalCode: '730000', cityCode: 'GS' },
  { cityNameCn: '青海省', cityNameEn: 'Qinghai', cityNamePinyin: 'Qinghai', postalCode: '810000', cityCode: 'QH' },
  { cityNameCn: '台湾省', cityNameEn: 'Taiwan', cityNamePinyin: 'Taiwan', postalCode: '100', cityCode: 'TW' },
  { cityNameCn: '内蒙古自治区', cityNameEn: 'Inner Mongolia', cityNamePinyin: 'Neimenggu', postalCode: '010000', cityCode: 'NM' },
  { cityNameCn: '广西壮族自治区', cityNameEn: 'Guangxi', cityNamePinyin: 'Guangxi', postalCode: '530000', cityCode: 'GX' },
  { cityNameCn: '西藏自治区', cityNameEn: 'Tibet', cityNamePinyin: 'Xizang', postalCode: '850000', cityCode: 'XZ' },
  { cityNameCn: '宁夏回族自治区', cityNameEn: 'Ningxia', cityNamePinyin: 'Ningxia', postalCode: '750000', cityCode: 'NX' },
  { cityNameCn: '新疆维吾尔自治区', cityNameEn: 'Xinjiang', cityNamePinyin: 'Xinjiang', postalCode: '830000', cityCode: 'XJ' },
  { cityNameCn: '香港特别行政区', cityNameEn: 'Hong Kong', cityNamePinyin: 'Xianggang', postalCode: '999077', cityCode: 'HK' },
  { cityNameCn: '澳门特别行政区', cityNameEn: 'Macau', cityNamePinyin: 'Aomen', postalCode: '999078', cityCode: 'MO' },
]

// 中国地级市数据 (level=2)，按省份分组
const citiesByProvince = {
  '河北省': [
    { cityNameCn: '石家庄市', cityNameEn: 'Shijiazhuang', cityNamePinyin: 'Shijiazhuang', postalCode: '050000' },
    { cityNameCn: '唐山市', cityNameEn: 'Tangshan', cityNamePinyin: 'Tangshan', postalCode: '063000' },
    { cityNameCn: '秦皇岛市', cityNameEn: 'Qinhuangdao', cityNamePinyin: 'Qinhuangdao', postalCode: '066000' },
    { cityNameCn: '邯郸市', cityNameEn: 'Handan', cityNamePinyin: 'Handan', postalCode: '056000' },
    { cityNameCn: '邢台市', cityNameEn: 'Xingtai', cityNamePinyin: 'Xingtai', postalCode: '054000' },
    { cityNameCn: '保定市', cityNameEn: 'Baoding', cityNamePinyin: 'Baoding', postalCode: '071000' },
    { cityNameCn: '张家口市', cityNameEn: 'Zhangjiakou', cityNamePinyin: 'Zhangjiakou', postalCode: '075000' },
    { cityNameCn: '承德市', cityNameEn: 'Chengde', cityNamePinyin: 'Chengde', postalCode: '067000' },
    { cityNameCn: '沧州市', cityNameEn: 'Cangzhou', cityNamePinyin: 'Cangzhou', postalCode: '061000' },
    { cityNameCn: '廊坊市', cityNameEn: 'Langfang', cityNamePinyin: 'Langfang', postalCode: '065000' },
    { cityNameCn: '衡水市', cityNameEn: 'Hengshui', cityNamePinyin: 'Hengshui', postalCode: '053000' },
  ],
  '山西省': [
    { cityNameCn: '太原市', cityNameEn: 'Taiyuan', cityNamePinyin: 'Taiyuan', postalCode: '030000' },
    { cityNameCn: '大同市', cityNameEn: 'Datong', cityNamePinyin: 'Datong', postalCode: '037000' },
    { cityNameCn: '阳泉市', cityNameEn: 'Yangquan', cityNamePinyin: 'Yangquan', postalCode: '045000' },
    { cityNameCn: '长治市', cityNameEn: 'Changzhi', cityNamePinyin: 'Changzhi', postalCode: '046000' },
    { cityNameCn: '晋城市', cityNameEn: 'Jincheng', cityNamePinyin: 'Jincheng', postalCode: '048000' },
    { cityNameCn: '朔州市', cityNameEn: 'Shuozhou', cityNamePinyin: 'Shuozhou', postalCode: '036000' },
    { cityNameCn: '晋中市', cityNameEn: 'Jinzhong', cityNamePinyin: 'Jinzhong', postalCode: '030600' },
    { cityNameCn: '运城市', cityNameEn: 'Yuncheng', cityNamePinyin: 'Yuncheng', postalCode: '044000' },
    { cityNameCn: '忻州市', cityNameEn: 'Xinzhou', cityNamePinyin: 'Xinzhou', postalCode: '034000' },
    { cityNameCn: '临汾市', cityNameEn: 'Linfen', cityNamePinyin: 'Linfen', postalCode: '041000' },
    { cityNameCn: '吕梁市', cityNameEn: 'Lvliang', cityNamePinyin: 'Lvliang', postalCode: '033000' },
  ],
  '辽宁省': [
    { cityNameCn: '沈阳市', cityNameEn: 'Shenyang', cityNamePinyin: 'Shenyang', postalCode: '110000' },
    { cityNameCn: '大连市', cityNameEn: 'Dalian', cityNamePinyin: 'Dalian', postalCode: '116000' },
    { cityNameCn: '鞍山市', cityNameEn: 'Anshan', cityNamePinyin: 'Anshan', postalCode: '114000' },
    { cityNameCn: '抚顺市', cityNameEn: 'Fushun', cityNamePinyin: 'Fushun', postalCode: '113000' },
    { cityNameCn: '本溪市', cityNameEn: 'Benxi', cityNamePinyin: 'Benxi', postalCode: '117000' },
    { cityNameCn: '丹东市', cityNameEn: 'Dandong', cityNamePinyin: 'Dandong', postalCode: '118000' },
    { cityNameCn: '锦州市', cityNameEn: 'Jinzhou', cityNamePinyin: 'Jinzhou', postalCode: '121000' },
    { cityNameCn: '营口市', cityNameEn: 'Yingkou', cityNamePinyin: 'Yingkou', postalCode: '115000' },
    { cityNameCn: '阜新市', cityNameEn: 'Fuxin', cityNamePinyin: 'Fuxin', postalCode: '123000' },
    { cityNameCn: '辽阳市', cityNameEn: 'Liaoyang', cityNamePinyin: 'Liaoyang', postalCode: '111000' },
    { cityNameCn: '盘锦市', cityNameEn: 'Panjin', cityNamePinyin: 'Panjin', postalCode: '124000' },
    { cityNameCn: '铁岭市', cityNameEn: 'Tieling', cityNamePinyin: 'Tieling', postalCode: '112000' },
    { cityNameCn: '朝阳市', cityNameEn: 'Chaoyang', cityNamePinyin: 'Chaoyang', postalCode: '122000' },
    { cityNameCn: '葫芦岛市', cityNameEn: 'Huludao', cityNamePinyin: 'Huludao', postalCode: '125000' },
  ],
  '吉林省': [
    { cityNameCn: '长春市', cityNameEn: 'Changchun', cityNamePinyin: 'Changchun', postalCode: '130000' },
    { cityNameCn: '吉林市', cityNameEn: 'Jilin', cityNamePinyin: 'Jilin', postalCode: '132000' },
    { cityNameCn: '四平市', cityNameEn: 'Siping', cityNamePinyin: 'Siping', postalCode: '136000' },
    { cityNameCn: '辽源市', cityNameEn: 'Liaoyuan', cityNamePinyin: 'Liaoyuan', postalCode: '136200' },
    { cityNameCn: '通化市', cityNameEn: 'Tonghua', cityNamePinyin: 'Tonghua', postalCode: '134000' },
    { cityNameCn: '白山市', cityNameEn: 'Baishan', cityNamePinyin: 'Baishan', postalCode: '134300' },
    { cityNameCn: '松原市', cityNameEn: 'Songyuan', cityNamePinyin: 'Songyuan', postalCode: '138000' },
    { cityNameCn: '白城市', cityNameEn: 'Baicheng', cityNamePinyin: 'Baicheng', postalCode: '137000' },
    { cityNameCn: '延边朝鲜族自治州', cityNameEn: 'Yanbian', cityNamePinyin: 'Yanbian', postalCode: '133000' },
  ],
  '黑龙江省': [
    { cityNameCn: '哈尔滨市', cityNameEn: 'Harbin', cityNamePinyin: 'Haerbin', postalCode: '150000' },
    { cityNameCn: '齐齐哈尔市', cityNameEn: 'Qiqihar', cityNamePinyin: 'Qiqihaer', postalCode: '161000' },
    { cityNameCn: '鸡西市', cityNameEn: 'Jixi', cityNamePinyin: 'Jixi', postalCode: '158100' },
    { cityNameCn: '鹤岗市', cityNameEn: 'Hegang', cityNamePinyin: 'Hegang', postalCode: '154100' },
    { cityNameCn: '双鸭山市', cityNameEn: 'Shuangyashan', cityNamePinyin: 'Shuangyashan', postalCode: '155100' },
    { cityNameCn: '大庆市', cityNameEn: 'Daqing', cityNamePinyin: 'Daqing', postalCode: '163000' },
    { cityNameCn: '伊春市', cityNameEn: 'Yichun', cityNamePinyin: 'Yichun', postalCode: '153000' },
    { cityNameCn: '佳木斯市', cityNameEn: 'Jiamusi', cityNamePinyin: 'Jiamusi', postalCode: '154000' },
    { cityNameCn: '七台河市', cityNameEn: 'Qitaihe', cityNamePinyin: 'Qitaihe', postalCode: '154600' },
    { cityNameCn: '牡丹江市', cityNameEn: 'Mudanjiang', cityNamePinyin: 'Mudanjiang', postalCode: '157000' },
    { cityNameCn: '黑河市', cityNameEn: 'Heihe', cityNamePinyin: 'Heihe', postalCode: '164300' },
    { cityNameCn: '绥化市', cityNameEn: 'Suihua', cityNamePinyin: 'Suihua', postalCode: '152000' },
    { cityNameCn: '大兴安岭地区', cityNameEn: 'Daxinganling', cityNamePinyin: 'Daxinganling', postalCode: '165000' },
  ],
  '江苏省': [
    { cityNameCn: '南京市', cityNameEn: 'Nanjing', cityNamePinyin: 'Nanjing', postalCode: '210000' },
    { cityNameCn: '无锡市', cityNameEn: 'Wuxi', cityNamePinyin: 'Wuxi', postalCode: '214000' },
    { cityNameCn: '徐州市', cityNameEn: 'Xuzhou', cityNamePinyin: 'Xuzhou', postalCode: '221000' },
    { cityNameCn: '常州市', cityNameEn: 'Changzhou', cityNamePinyin: 'Changzhou', postalCode: '213000' },
    { cityNameCn: '苏州市', cityNameEn: 'Suzhou', cityNamePinyin: 'Suzhou', postalCode: '215000' },
    { cityNameCn: '南通市', cityNameEn: 'Nantong', cityNamePinyin: 'Nantong', postalCode: '226000' },
    { cityNameCn: '连云港市', cityNameEn: 'Lianyungang', cityNamePinyin: 'Lianyungang', postalCode: '222000' },
    { cityNameCn: '淮安市', cityNameEn: 'Huaian', cityNamePinyin: 'Huaian', postalCode: '223000' },
    { cityNameCn: '盐城市', cityNameEn: 'Yancheng', cityNamePinyin: 'Yancheng', postalCode: '224000' },
    { cityNameCn: '扬州市', cityNameEn: 'Yangzhou', cityNamePinyin: 'Yangzhou', postalCode: '225000' },
    { cityNameCn: '镇江市', cityNameEn: 'Zhenjiang', cityNamePinyin: 'Zhenjiang', postalCode: '212000' },
    { cityNameCn: '泰州市', cityNameEn: 'Taizhou', cityNamePinyin: 'Taizhou', postalCode: '225300' },
    { cityNameCn: '宿迁市', cityNameEn: 'Suqian', cityNamePinyin: 'Suqian', postalCode: '223800' },
  ],
  '浙江省': [
    { cityNameCn: '杭州市', cityNameEn: 'Hangzhou', cityNamePinyin: 'Hangzhou', postalCode: '310000' },
    { cityNameCn: '宁波市', cityNameEn: 'Ningbo', cityNamePinyin: 'Ningbo', postalCode: '315000' },
    { cityNameCn: '温州市', cityNameEn: 'Wenzhou', cityNamePinyin: 'Wenzhou', postalCode: '325000' },
    { cityNameCn: '嘉兴市', cityNameEn: 'Jiaxing', cityNamePinyin: 'Jiaxing', postalCode: '314000' },
    { cityNameCn: '湖州市', cityNameEn: 'Huzhou', cityNamePinyin: 'Huzhou', postalCode: '313000' },
    { cityNameCn: '绍兴市', cityNameEn: 'Shaoxing', cityNamePinyin: 'Shaoxing', postalCode: '312000' },
    { cityNameCn: '金华市', cityNameEn: 'Jinhua', cityNamePinyin: 'Jinhua', postalCode: '321000' },
    { cityNameCn: '衢州市', cityNameEn: 'Quzhou', cityNamePinyin: 'Quzhou', postalCode: '324000' },
    { cityNameCn: '舟山市', cityNameEn: 'Zhoushan', cityNamePinyin: 'Zhoushan', postalCode: '316000' },
    { cityNameCn: '台州市', cityNameEn: 'Taizhou', cityNamePinyin: 'Taizhou', postalCode: '318000' },
    { cityNameCn: '丽水市', cityNameEn: 'Lishui', cityNamePinyin: 'Lishui', postalCode: '323000' },
  ],
  '安徽省': [
    { cityNameCn: '合肥市', cityNameEn: 'Hefei', cityNamePinyin: 'Hefei', postalCode: '230000' },
    { cityNameCn: '芜湖市', cityNameEn: 'Wuhu', cityNamePinyin: 'Wuhu', postalCode: '241000' },
    { cityNameCn: '蚌埠市', cityNameEn: 'Bengbu', cityNamePinyin: 'Bengbu', postalCode: '233000' },
    { cityNameCn: '淮南市', cityNameEn: 'Huainan', cityNamePinyin: 'Huainan', postalCode: '232000' },
    { cityNameCn: '马鞍山市', cityNameEn: 'Maanshan', cityNamePinyin: 'Maanshan', postalCode: '243000' },
    { cityNameCn: '淮北市', cityNameEn: 'Huaibei', cityNamePinyin: 'Huaibei', postalCode: '235000' },
    { cityNameCn: '铜陵市', cityNameEn: 'Tongling', cityNamePinyin: 'Tongling', postalCode: '244000' },
    { cityNameCn: '安庆市', cityNameEn: 'Anqing', cityNamePinyin: 'Anqing', postalCode: '246000' },
    { cityNameCn: '黄山市', cityNameEn: 'Huangshan', cityNamePinyin: 'Huangshan', postalCode: '245000' },
    { cityNameCn: '滁州市', cityNameEn: 'Chuzhou', cityNamePinyin: 'Chuzhou', postalCode: '239000' },
    { cityNameCn: '阜阳市', cityNameEn: 'Fuyang', cityNamePinyin: 'Fuyang', postalCode: '236000' },
    { cityNameCn: '宿州市', cityNameEn: 'Suzhou', cityNamePinyin: 'Suzhou', postalCode: '234000' },
    { cityNameCn: '六安市', cityNameEn: 'Luan', cityNamePinyin: 'Luan', postalCode: '237000' },
    { cityNameCn: '亳州市', cityNameEn: 'Bozhou', cityNamePinyin: 'Bozhou', postalCode: '236800' },
    { cityNameCn: '池州市', cityNameEn: 'Chizhou', cityNamePinyin: 'Chizhou', postalCode: '247100' },
    { cityNameCn: '宣城市', cityNameEn: 'Xuancheng', cityNamePinyin: 'Xuancheng', postalCode: '242000' },
  ],
  '福建省': [
    { cityNameCn: '福州市', cityNameEn: 'Fuzhou', cityNamePinyin: 'Fuzhou', postalCode: '350000' },
    { cityNameCn: '厦门市', cityNameEn: 'Xiamen', cityNamePinyin: 'Xiamen', postalCode: '361000' },
    { cityNameCn: '莆田市', cityNameEn: 'Putian', cityNamePinyin: 'Putian', postalCode: '351100' },
    { cityNameCn: '三明市', cityNameEn: 'Sanming', cityNamePinyin: 'Sanming', postalCode: '365000' },
    { cityNameCn: '泉州市', cityNameEn: 'Quanzhou', cityNamePinyin: 'Quanzhou', postalCode: '362000' },
    { cityNameCn: '漳州市', cityNameEn: 'Zhangzhou', cityNamePinyin: 'Zhangzhou', postalCode: '363000' },
    { cityNameCn: '南平市', cityNameEn: 'Nanping', cityNamePinyin: 'Nanping', postalCode: '353000' },
    { cityNameCn: '龙岩市', cityNameEn: 'Longyan', cityNamePinyin: 'Longyan', postalCode: '364000' },
    { cityNameCn: '宁德市', cityNameEn: 'Ningde', cityNamePinyin: 'Ningde', postalCode: '352100' },
  ],
  '江西省': [
    { cityNameCn: '南昌市', cityNameEn: 'Nanchang', cityNamePinyin: 'Nanchang', postalCode: '330000' },
    { cityNameCn: '景德镇市', cityNameEn: 'Jingdezhen', cityNamePinyin: 'Jingdezhen', postalCode: '333000' },
    { cityNameCn: '萍乡市', cityNameEn: 'Pingxiang', cityNamePinyin: 'Pingxiang', postalCode: '337000' },
    { cityNameCn: '九江市', cityNameEn: 'Jiujiang', cityNamePinyin: 'Jiujiang', postalCode: '332000' },
    { cityNameCn: '新余市', cityNameEn: 'Xinyu', cityNamePinyin: 'Xinyu', postalCode: '338000' },
    { cityNameCn: '鹰潭市', cityNameEn: 'Yingtan', cityNamePinyin: 'Yingtan', postalCode: '335000' },
    { cityNameCn: '赣州市', cityNameEn: 'Ganzhou', cityNamePinyin: 'Ganzhou', postalCode: '341000' },
    { cityNameCn: '吉安市', cityNameEn: 'Jian', cityNamePinyin: 'Jian', postalCode: '343000' },
    { cityNameCn: '宜春市', cityNameEn: 'Yichun', cityNamePinyin: 'Yichun', postalCode: '336000' },
    { cityNameCn: '抚州市', cityNameEn: 'Fuzhou', cityNamePinyin: 'Fuzhou', postalCode: '344000' },
    { cityNameCn: '上饶市', cityNameEn: 'Shangrao', cityNamePinyin: 'Shangrao', postalCode: '334000' },
  ],
  '山东省': [
    { cityNameCn: '济南市', cityNameEn: 'Jinan', cityNamePinyin: 'Jinan', postalCode: '250000' },
    { cityNameCn: '青岛市', cityNameEn: 'Qingdao', cityNamePinyin: 'Qingdao', postalCode: '266000' },
    { cityNameCn: '淄博市', cityNameEn: 'Zibo', cityNamePinyin: 'Zibo', postalCode: '255000' },
    { cityNameCn: '枣庄市', cityNameEn: 'Zaozhuang', cityNamePinyin: 'Zaozhuang', postalCode: '277100' },
    { cityNameCn: '东营市', cityNameEn: 'Dongying', cityNamePinyin: 'Dongying', postalCode: '257000' },
    { cityNameCn: '烟台市', cityNameEn: 'Yantai', cityNamePinyin: 'Yantai', postalCode: '264000' },
    { cityNameCn: '潍坊市', cityNameEn: 'Weifang', cityNamePinyin: 'Weifang', postalCode: '261000' },
    { cityNameCn: '济宁市', cityNameEn: 'Jining', cityNamePinyin: 'Jining', postalCode: '272000' },
    { cityNameCn: '泰安市', cityNameEn: 'Taian', cityNamePinyin: 'Taian', postalCode: '271000' },
    { cityNameCn: '威海市', cityNameEn: 'Weihai', cityNamePinyin: 'Weihai', postalCode: '264200' },
    { cityNameCn: '日照市', cityNameEn: 'Rizhao', cityNamePinyin: 'Rizhao', postalCode: '276800' },
    { cityNameCn: '临沂市', cityNameEn: 'Linyi', cityNamePinyin: 'Linyi', postalCode: '276000' },
    { cityNameCn: '德州市', cityNameEn: 'Dezhou', cityNamePinyin: 'Dezhou', postalCode: '253000' },
    { cityNameCn: '聊城市', cityNameEn: 'Liaocheng', cityNamePinyin: 'Liaocheng', postalCode: '252000' },
    { cityNameCn: '滨州市', cityNameEn: 'Binzhou', cityNamePinyin: 'Binzhou', postalCode: '256600' },
    { cityNameCn: '菏泽市', cityNameEn: 'Heze', cityNamePinyin: 'Heze', postalCode: '274000' },
  ],
  '河南省': [
    { cityNameCn: '郑州市', cityNameEn: 'Zhengzhou', cityNamePinyin: 'Zhengzhou', postalCode: '450000' },
    { cityNameCn: '开封市', cityNameEn: 'Kaifeng', cityNamePinyin: 'Kaifeng', postalCode: '475000' },
    { cityNameCn: '洛阳市', cityNameEn: 'Luoyang', cityNamePinyin: 'Luoyang', postalCode: '471000' },
    { cityNameCn: '平顶山市', cityNameEn: 'Pingdingshan', cityNamePinyin: 'Pingdingshan', postalCode: '467000' },
    { cityNameCn: '安阳市', cityNameEn: 'Anyang', cityNamePinyin: 'Anyang', postalCode: '455000' },
    { cityNameCn: '鹤壁市', cityNameEn: 'Hebi', cityNamePinyin: 'Hebi', postalCode: '458000' },
    { cityNameCn: '新乡市', cityNameEn: 'Xinxiang', cityNamePinyin: 'Xinxiang', postalCode: '453000' },
    { cityNameCn: '焦作市', cityNameEn: 'Jiaozuo', cityNamePinyin: 'Jiaozuo', postalCode: '454000' },
    { cityNameCn: '濮阳市', cityNameEn: 'Puyang', cityNamePinyin: 'Puyang', postalCode: '457000' },
    { cityNameCn: '许昌市', cityNameEn: 'Xuchang', cityNamePinyin: 'Xuchang', postalCode: '461000' },
    { cityNameCn: '漯河市', cityNameEn: 'Luohe', cityNamePinyin: 'Luohe', postalCode: '462000' },
    { cityNameCn: '三门峡市', cityNameEn: 'Sanmenxia', cityNamePinyin: 'Sanmenxia', postalCode: '472000' },
    { cityNameCn: '南阳市', cityNameEn: 'Nanyang', cityNamePinyin: 'Nanyang', postalCode: '473000' },
    { cityNameCn: '商丘市', cityNameEn: 'Shangqiu', cityNamePinyin: 'Shangqiu', postalCode: '476000' },
    { cityNameCn: '信阳市', cityNameEn: 'Xinyang', cityNamePinyin: 'Xinyang', postalCode: '464000' },
    { cityNameCn: '周口市', cityNameEn: 'Zhoukou', cityNamePinyin: 'Zhoukou', postalCode: '466000' },
    { cityNameCn: '驻马店市', cityNameEn: 'Zhumadian', cityNamePinyin: 'Zhumadian', postalCode: '463000' },
    { cityNameCn: '济源市', cityNameEn: 'Jiyuan', cityNamePinyin: 'Jiyuan', postalCode: '459000' },
  ],
  '湖北省': [
    { cityNameCn: '武汉市', cityNameEn: 'Wuhan', cityNamePinyin: 'Wuhan', postalCode: '430000' },
    { cityNameCn: '黄石市', cityNameEn: 'Huangshi', cityNamePinyin: 'Huangshi', postalCode: '435000' },
    { cityNameCn: '十堰市', cityNameEn: 'Shiyan', cityNamePinyin: 'Shiyan', postalCode: '442000' },
    { cityNameCn: '宜昌市', cityNameEn: 'Yichang', cityNamePinyin: 'Yichang', postalCode: '443000' },
    { cityNameCn: '襄阳市', cityNameEn: 'Xiangyang', cityNamePinyin: 'Xiangyang', postalCode: '441000' },
    { cityNameCn: '鄂州市', cityNameEn: 'Ezhou', cityNamePinyin: 'Ezhou', postalCode: '436000' },
    { cityNameCn: '荆门市', cityNameEn: 'Jingmen', cityNamePinyin: 'Jingmen', postalCode: '448000' },
    { cityNameCn: '孝感市', cityNameEn: 'Xiaogan', cityNamePinyin: 'Xiaogan', postalCode: '432000' },
    { cityNameCn: '荆州市', cityNameEn: 'Jingzhou', cityNamePinyin: 'Jingzhou', postalCode: '434000' },
    { cityNameCn: '黄冈市', cityNameEn: 'Huanggang', cityNamePinyin: 'Huanggang', postalCode: '438000' },
    { cityNameCn: '咸宁市', cityNameEn: 'Xianning', cityNamePinyin: 'Xianning', postalCode: '437000' },
    { cityNameCn: '随州市', cityNameEn: 'Suizhou', cityNamePinyin: 'Suizhou', postalCode: '441300' },
    { cityNameCn: '恩施土家族苗族自治州', cityNameEn: 'Enshi', cityNamePinyin: 'Enshi', postalCode: '445000' },
    { cityNameCn: '仙桃市', cityNameEn: 'Xiantao', cityNamePinyin: 'Xiantao', postalCode: '433000' },
    { cityNameCn: '潜江市', cityNameEn: 'Qianjiang', cityNamePinyin: 'Qianjiang', postalCode: '433100' },
    { cityNameCn: '天门市', cityNameEn: 'Tianmen', cityNamePinyin: 'Tianmen', postalCode: '431700' },
    { cityNameCn: '神农架林区', cityNameEn: 'Shennongjia', cityNamePinyin: 'Shennongjia', postalCode: '442400' },
  ],
  '湖南省': [
    { cityNameCn: '长沙市', cityNameEn: 'Changsha', cityNamePinyin: 'Changsha', postalCode: '410000' },
    { cityNameCn: '株洲市', cityNameEn: 'Zhuzhou', cityNamePinyin: 'Zhuzhou', postalCode: '412000' },
    { cityNameCn: '湘潭市', cityNameEn: 'Xiangtan', cityNamePinyin: 'Xiangtan', postalCode: '411100' },
    { cityNameCn: '衡阳市', cityNameEn: 'Hengyang', cityNamePinyin: 'Hengyang', postalCode: '421000' },
    { cityNameCn: '邵阳市', cityNameEn: 'Shaoyang', cityNamePinyin: 'Shaoyang', postalCode: '422000' },
    { cityNameCn: '岳阳市', cityNameEn: 'Yueyang', cityNamePinyin: 'Yueyang', postalCode: '414000' },
    { cityNameCn: '常德市', cityNameEn: 'Changde', cityNamePinyin: 'Changde', postalCode: '415000' },
    { cityNameCn: '张家界市', cityNameEn: 'Zhangjiajie', cityNamePinyin: 'Zhangjiajie', postalCode: '427000' },
    { cityNameCn: '益阳市', cityNameEn: 'Yiyang', cityNamePinyin: 'Yiyang', postalCode: '413000' },
    { cityNameCn: '郴州市', cityNameEn: 'Chenzhou', cityNamePinyin: 'Chenzhou', postalCode: '423000' },
    { cityNameCn: '永州市', cityNameEn: 'Yongzhou', cityNamePinyin: 'Yongzhou', postalCode: '425000' },
    { cityNameCn: '怀化市', cityNameEn: 'Huaihua', cityNamePinyin: 'Huaihua', postalCode: '418000' },
    { cityNameCn: '娄底市', cityNameEn: 'Loudi', cityNamePinyin: 'Loudi', postalCode: '417000' },
    { cityNameCn: '湘西土家族苗族自治州', cityNameEn: 'Xiangxi', cityNamePinyin: 'Xiangxi', postalCode: '416000' },
  ],
  '广东省': [
    { cityNameCn: '广州市', cityNameEn: 'Guangzhou', cityNamePinyin: 'Guangzhou', postalCode: '510000' },
    { cityNameCn: '韶关市', cityNameEn: 'Shaoguan', cityNamePinyin: 'Shaoguan', postalCode: '512000' },
    { cityNameCn: '深圳市', cityNameEn: 'Shenzhen', cityNamePinyin: 'Shenzhen', postalCode: '518000' },
    { cityNameCn: '珠海市', cityNameEn: 'Zhuhai', cityNamePinyin: 'Zhuhai', postalCode: '519000' },
    { cityNameCn: '汕头市', cityNameEn: 'Shantou', cityNamePinyin: 'Shantou', postalCode: '515000' },
    { cityNameCn: '佛山市', cityNameEn: 'Foshan', cityNamePinyin: 'Foshan', postalCode: '528000' },
    { cityNameCn: '江门市', cityNameEn: 'Jiangmen', cityNamePinyin: 'Jiangmen', postalCode: '529000' },
    { cityNameCn: '湛江市', cityNameEn: 'Zhanjiang', cityNamePinyin: 'Zhanjiang', postalCode: '524000' },
    { cityNameCn: '茂名市', cityNameEn: 'Maoming', cityNamePinyin: 'Maoming', postalCode: '525000' },
    { cityNameCn: '肇庆市', cityNameEn: 'Zhaoqing', cityNamePinyin: 'Zhaoqing', postalCode: '526000' },
    { cityNameCn: '惠州市', cityNameEn: 'Huizhou', cityNamePinyin: 'Huizhou', postalCode: '516000' },
    { cityNameCn: '梅州市', cityNameEn: 'Meizhou', cityNamePinyin: 'Meizhou', postalCode: '514000' },
    { cityNameCn: '汕尾市', cityNameEn: 'Shanwei', cityNamePinyin: 'Shanwei', postalCode: '516600' },
    { cityNameCn: '河源市', cityNameEn: 'Heyuan', cityNamePinyin: 'Heyuan', postalCode: '517000' },
    { cityNameCn: '阳江市', cityNameEn: 'Yangjiang', cityNamePinyin: 'Yangjiang', postalCode: '529500' },
    { cityNameCn: '清远市', cityNameEn: 'Qingyuan', cityNamePinyin: 'Qingyuan', postalCode: '511500' },
    { cityNameCn: '东莞市', cityNameEn: 'Dongguan', cityNamePinyin: 'Dongguan', postalCode: '523000' },
    { cityNameCn: '中山市', cityNameEn: 'Zhongshan', cityNamePinyin: 'Zhongshan', postalCode: '528400' },
    { cityNameCn: '潮州市', cityNameEn: 'Chaozhou', cityNamePinyin: 'Chaozhou', postalCode: '521000' },
    { cityNameCn: '揭阳市', cityNameEn: 'Jieyang', cityNamePinyin: 'Jieyang', postalCode: '522000' },
    { cityNameCn: '云浮市', cityNameEn: 'Yunfu', cityNamePinyin: 'Yunfu', postalCode: '527300' },
  ],
  '海南省': [
    { cityNameCn: '海口市', cityNameEn: 'Haikou', cityNamePinyin: 'Haikou', postalCode: '570000' },
    { cityNameCn: '三亚市', cityNameEn: 'Sanya', cityNamePinyin: 'Sanya', postalCode: '572000' },
    { cityNameCn: '三沙市', cityNameEn: 'Sansha', cityNamePinyin: 'Sansha', postalCode: '573100' },
    { cityNameCn: '儋州市', cityNameEn: 'Danzhou', cityNamePinyin: 'Danzhou', postalCode: '571700' },
  ],
  '四川省': [
    { cityNameCn: '成都市', cityNameEn: 'Chengdu', cityNamePinyin: 'Chengdu', postalCode: '610000' },
    { cityNameCn: '自贡市', cityNameEn: 'Zigong', cityNamePinyin: 'Zigong', postalCode: '643000' },
    { cityNameCn: '攀枝花市', cityNameEn: 'Panzhihua', cityNamePinyin: 'Panzhihua', postalCode: '617000' },
    { cityNameCn: '泸州市', cityNameEn: 'Luzhou', cityNamePinyin: 'Luzhou', postalCode: '646000' },
    { cityNameCn: '德阳市', cityNameEn: 'Deyang', cityNamePinyin: 'Deyang', postalCode: '618000' },
    { cityNameCn: '绵阳市', cityNameEn: 'Mianyang', cityNamePinyin: 'Mianyang', postalCode: '621000' },
    { cityNameCn: '广元市', cityNameEn: 'Guangyuan', cityNamePinyin: 'Guangyuan', postalCode: '628000' },
    { cityNameCn: '遂宁市', cityNameEn: 'Suining', cityNamePinyin: 'Suining', postalCode: '629000' },
    { cityNameCn: '内江市', cityNameEn: 'Neijiang', cityNamePinyin: 'Neijiang', postalCode: '641000' },
    { cityNameCn: '乐山市', cityNameEn: 'Leshan', cityNamePinyin: 'Leshan', postalCode: '614000' },
    { cityNameCn: '南充市', cityNameEn: 'Nanchong', cityNamePinyin: 'Nanchong', postalCode: '637000' },
    { cityNameCn: '眉山市', cityNameEn: 'Meishan', cityNamePinyin: 'Meishan', postalCode: '620000' },
    { cityNameCn: '宜宾市', cityNameEn: 'Yibin', cityNamePinyin: 'Yibin', postalCode: '644000' },
    { cityNameCn: '广安市', cityNameEn: 'Guangan', cityNamePinyin: 'Guangan', postalCode: '638000' },
    { cityNameCn: '达州市', cityNameEn: 'Dazhou', cityNamePinyin: 'Dazhou', postalCode: '635000' },
    { cityNameCn: '雅安市', cityNameEn: 'Yaan', cityNamePinyin: 'Yaan', postalCode: '625000' },
    { cityNameCn: '巴中市', cityNameEn: 'Bazhong', cityNamePinyin: 'Bazhong', postalCode: '636000' },
    { cityNameCn: '资阳市', cityNameEn: 'Ziyang', cityNamePinyin: 'Ziyang', postalCode: '641300' },
    { cityNameCn: '阿坝藏族羌族自治州', cityNameEn: 'Aba', cityNamePinyin: 'Aba', postalCode: '624000' },
    { cityNameCn: '甘孜藏族自治州', cityNameEn: 'Ganzi', cityNamePinyin: 'Ganzi', postalCode: '626000' },
    { cityNameCn: '凉山彝族自治州', cityNameEn: 'Liangshan', cityNamePinyin: 'Liangshan', postalCode: '615000' },
  ],
  '贵州省': [
    { cityNameCn: '贵阳市', cityNameEn: 'Guiyang', cityNamePinyin: 'Guiyang', postalCode: '550000' },
    { cityNameCn: '六盘水市', cityNameEn: 'Liupanshui', cityNamePinyin: 'Liupanshui', postalCode: '553000' },
    { cityNameCn: '遵义市', cityNameEn: 'Zunyi', cityNamePinyin: 'Zunyi', postalCode: '563000' },
    { cityNameCn: '安顺市', cityNameEn: 'Anshun', cityNamePinyin: 'Anshun', postalCode: '561000' },
    { cityNameCn: '毕节市', cityNameEn: 'Bijie', cityNamePinyin: 'Bijie', postalCode: '551700' },
    { cityNameCn: '铜仁市', cityNameEn: 'Tongren', cityNamePinyin: 'Tongren', postalCode: '554300' },
    { cityNameCn: '黔西南布依族苗族自治州', cityNameEn: 'Qianxinan', cityNamePinyin: 'Qianxinan', postalCode: '562400' },
    { cityNameCn: '黔东南苗族侗族自治州', cityNameEn: 'Qiandongnan', cityNamePinyin: 'Qiandongnan', postalCode: '556000' },
    { cityNameCn: '黔南布依族苗族自治州', cityNameEn: 'Qiannan', cityNamePinyin: 'Qiannan', postalCode: '558000' },
  ],
  '云南省': [
    { cityNameCn: '昆明市', cityNameEn: 'Kunming', cityNamePinyin: 'Kunming', postalCode: '650000' },
    { cityNameCn: '曲靖市', cityNameEn: 'Qujing', cityNamePinyin: 'Qujing', postalCode: '655000' },
    { cityNameCn: '玉溪市', cityNameEn: 'Yuxi', cityNamePinyin: 'Yuxi', postalCode: '653100' },
    { cityNameCn: '保山市', cityNameEn: 'Baoshan', cityNamePinyin: 'Baoshan', postalCode: '678000' },
    { cityNameCn: '昭通市', cityNameEn: 'Zhaotong', cityNamePinyin: 'Zhaotong', postalCode: '657000' },
    { cityNameCn: '丽江市', cityNameEn: 'Lijiang', cityNamePinyin: 'Lijiang', postalCode: '674100' },
    { cityNameCn: '普洱市', cityNameEn: 'Puer', cityNamePinyin: 'Puer', postalCode: '665000' },
    { cityNameCn: '临沧市', cityNameEn: 'Lincang', cityNamePinyin: 'Lincang', postalCode: '677000' },
    { cityNameCn: '楚雄彝族自治州', cityNameEn: 'Chuxiong', cityNamePinyin: 'Chuxiong', postalCode: '675000' },
    { cityNameCn: '红河哈尼族彝族自治州', cityNameEn: 'Honghe', cityNamePinyin: 'Honghe', postalCode: '661100' },
    { cityNameCn: '文山壮族苗族自治州', cityNameEn: 'Wenshan', cityNamePinyin: 'Wenshan', postalCode: '663000' },
    { cityNameCn: '西双版纳傣族自治州', cityNameEn: 'Xishuangbanna', cityNamePinyin: 'Xishuangbanna', postalCode: '666100' },
    { cityNameCn: '大理白族自治州', cityNameEn: 'Dali', cityNamePinyin: 'Dali', postalCode: '671000' },
    { cityNameCn: '德宏傣族景颇族自治州', cityNameEn: 'Dehong', cityNamePinyin: 'Dehong', postalCode: '678400' },
    { cityNameCn: '怒江傈僳族自治州', cityNameEn: 'Nujiang', cityNamePinyin: 'Nujiang', postalCode: '673100' },
    { cityNameCn: '迪庆藏族自治州', cityNameEn: 'Diqing', cityNamePinyin: 'Diqing', postalCode: '674400' },
  ],
  '陕西省': [
    { cityNameCn: '西安市', cityNameEn: 'Xian', cityNamePinyin: 'Xian', postalCode: '710000' },
    { cityNameCn: '铜川市', cityNameEn: 'Tongchuan', cityNamePinyin: 'Tongchuan', postalCode: '727000' },
    { cityNameCn: '宝鸡市', cityNameEn: 'Baoji', cityNamePinyin: 'Baoji', postalCode: '721000' },
    { cityNameCn: '咸阳市', cityNameEn: 'Xianyang', cityNamePinyin: 'Xianyang', postalCode: '712000' },
    { cityNameCn: '渭南市', cityNameEn: 'Weinan', cityNamePinyin: 'Weinan', postalCode: '714000' },
    { cityNameCn: '延安市', cityNameEn: 'Yanan', cityNamePinyin: 'Yanan', postalCode: '716000' },
    { cityNameCn: '汉中市', cityNameEn: 'Hanzhong', cityNamePinyin: 'Hanzhong', postalCode: '723000' },
    { cityNameCn: '榆林市', cityNameEn: 'Yulin', cityNamePinyin: 'Yulin', postalCode: '719000' },
    { cityNameCn: '安康市', cityNameEn: 'Ankang', cityNamePinyin: 'Ankang', postalCode: '725000' },
    { cityNameCn: '商洛市', cityNameEn: 'Shangluo', cityNamePinyin: 'Shangluo', postalCode: '726000' },
  ],
  '甘肃省': [
    { cityNameCn: '兰州市', cityNameEn: 'Lanzhou', cityNamePinyin: 'Lanzhou', postalCode: '730000' },
    { cityNameCn: '嘉峪关市', cityNameEn: 'Jiayuguan', cityNamePinyin: 'Jiayuguan', postalCode: '735100' },
    { cityNameCn: '金昌市', cityNameEn: 'Jinchang', cityNamePinyin: 'Jinchang', postalCode: '737100' },
    { cityNameCn: '白银市', cityNameEn: 'Baiyin', cityNamePinyin: 'Baiyin', postalCode: '730900' },
    { cityNameCn: '天水市', cityNameEn: 'Tianshui', cityNamePinyin: 'Tianshui', postalCode: '741000' },
    { cityNameCn: '武威市', cityNameEn: 'Wuwei', cityNamePinyin: 'Wuwei', postalCode: '733000' },
    { cityNameCn: '张掖市', cityNameEn: 'Zhangye', cityNamePinyin: 'Zhangye', postalCode: '734000' },
    { cityNameCn: '平凉市', cityNameEn: 'Pingliang', cityNamePinyin: 'Pingliang', postalCode: '744000' },
    { cityNameCn: '酒泉市', cityNameEn: 'Jiuquan', cityNamePinyin: 'Jiuquan', postalCode: '735000' },
    { cityNameCn: '庆阳市', cityNameEn: 'Qingyang', cityNamePinyin: 'Qingyang', postalCode: '745000' },
    { cityNameCn: '定西市', cityNameEn: 'Dingxi', cityNamePinyin: 'Dingxi', postalCode: '743000' },
    { cityNameCn: '陇南市', cityNameEn: 'Longnan', cityNamePinyin: 'Longnan', postalCode: '746000' },
    { cityNameCn: '临夏回族自治州', cityNameEn: 'Linxia', cityNamePinyin: 'Linxia', postalCode: '731100' },
    { cityNameCn: '甘南藏族自治州', cityNameEn: 'Gannan', cityNamePinyin: 'Gannan', postalCode: '747000' },
  ],
  '青海省': [
    { cityNameCn: '西宁市', cityNameEn: 'Xining', cityNamePinyin: 'Xining', postalCode: '810000' },
    { cityNameCn: '海东市', cityNameEn: 'Haidong', cityNamePinyin: 'Haidong', postalCode: '810600' },
    { cityNameCn: '海北藏族自治州', cityNameEn: 'Haibei', cityNamePinyin: 'Haibei', postalCode: '812200' },
    { cityNameCn: '黄南藏族自治州', cityNameEn: 'Huangnan', cityNamePinyin: 'Huangnan', postalCode: '811300' },
    { cityNameCn: '海南藏族自治州', cityNameEn: 'Hainan', cityNamePinyin: 'Hainan', postalCode: '813000' },
    { cityNameCn: '果洛藏族自治州', cityNameEn: 'Guoluo', cityNamePinyin: 'Guoluo', postalCode: '814000' },
    { cityNameCn: '玉树藏族自治州', cityNameEn: 'Yushu', cityNamePinyin: 'Yushu', postalCode: '815000' },
    { cityNameCn: '海西蒙古族藏族自治州', cityNameEn: 'Haixi', cityNamePinyin: 'Haixi', postalCode: '817000' },
  ],
  '内蒙古自治区': [
    { cityNameCn: '呼和浩特市', cityNameEn: 'Hohhot', cityNamePinyin: 'Huhehaote', postalCode: '010000' },
    { cityNameCn: '包头市', cityNameEn: 'Baotou', cityNamePinyin: 'Baotou', postalCode: '014000' },
    { cityNameCn: '乌海市', cityNameEn: 'Wuhai', cityNamePinyin: 'Wuhai', postalCode: '016000' },
    { cityNameCn: '赤峰市', cityNameEn: 'Chifeng', cityNamePinyin: 'Chifeng', postalCode: '024000' },
    { cityNameCn: '通辽市', cityNameEn: 'Tongliao', cityNamePinyin: 'Tongliao', postalCode: '028000' },
    { cityNameCn: '鄂尔多斯市', cityNameEn: 'Ordos', cityNamePinyin: 'Eerduosi', postalCode: '017000' },
    { cityNameCn: '呼伦贝尔市', cityNameEn: 'Hulunbuir', cityNamePinyin: 'Hulunbeier', postalCode: '021000' },
    { cityNameCn: '巴彦淖尔市', cityNameEn: 'Bayan Nur', cityNamePinyin: 'Bayannaoer', postalCode: '015000' },
    { cityNameCn: '乌兰察布市', cityNameEn: 'Ulanqab', cityNamePinyin: 'Wulanchabu', postalCode: '012000' },
    { cityNameCn: '兴安盟', cityNameEn: 'Hinggan', cityNamePinyin: 'Xingan', postalCode: '137400' },
    { cityNameCn: '锡林郭勒盟', cityNameEn: 'Xilin Gol', cityNamePinyin: 'Xilinguole', postalCode: '026000' },
    { cityNameCn: '阿拉善盟', cityNameEn: 'Alxa', cityNamePinyin: 'Alashan', postalCode: '750300' },
  ],
  '广西壮族自治区': [
    { cityNameCn: '南宁市', cityNameEn: 'Nanning', cityNamePinyin: 'Nanning', postalCode: '530000' },
    { cityNameCn: '柳州市', cityNameEn: 'Liuzhou', cityNamePinyin: 'Liuzhou', postalCode: '545000' },
    { cityNameCn: '桂林市', cityNameEn: 'Guilin', cityNamePinyin: 'Guilin', postalCode: '541000' },
    { cityNameCn: '梧州市', cityNameEn: 'Wuzhou', cityNamePinyin: 'Wuzhou', postalCode: '543000' },
    { cityNameCn: '北海市', cityNameEn: 'Beihai', cityNamePinyin: 'Beihai', postalCode: '536000' },
    { cityNameCn: '防城港市', cityNameEn: 'Fangchenggang', cityNamePinyin: 'Fangchenggang', postalCode: '538000' },
    { cityNameCn: '钦州市', cityNameEn: 'Qinzhou', cityNamePinyin: 'Qinzhou', postalCode: '535000' },
    { cityNameCn: '贵港市', cityNameEn: 'Guigang', cityNamePinyin: 'Guigang', postalCode: '537100' },
    { cityNameCn: '玉林市', cityNameEn: 'Yulin', cityNamePinyin: 'Yulin', postalCode: '537000' },
    { cityNameCn: '百色市', cityNameEn: 'Baise', cityNamePinyin: 'Baise', postalCode: '533000' },
    { cityNameCn: '贺州市', cityNameEn: 'Hezhou', cityNamePinyin: 'Hezhou', postalCode: '542800' },
    { cityNameCn: '河池市', cityNameEn: 'Hechi', cityNamePinyin: 'Hechi', postalCode: '547000' },
    { cityNameCn: '来宾市', cityNameEn: 'Laibin', cityNamePinyin: 'Laibin', postalCode: '546100' },
    { cityNameCn: '崇左市', cityNameEn: 'Chongzuo', cityNamePinyin: 'Chongzuo', postalCode: '532200' },
  ],
  '西藏自治区': [
    { cityNameCn: '拉萨市', cityNameEn: 'Lhasa', cityNamePinyin: 'Lasa', postalCode: '850000' },
    { cityNameCn: '日喀则市', cityNameEn: 'Shigatse', cityNamePinyin: 'Rikaze', postalCode: '857000' },
    { cityNameCn: '昌都市', cityNameEn: 'Chamdo', cityNamePinyin: 'Changdu', postalCode: '854000' },
    { cityNameCn: '林芝市', cityNameEn: 'Nyingchi', cityNamePinyin: 'Linzhi', postalCode: '860000' },
    { cityNameCn: '山南市', cityNameEn: 'Shannan', cityNamePinyin: 'Shannan', postalCode: '856000' },
    { cityNameCn: '那曲市', cityNameEn: 'Nagqu', cityNamePinyin: 'Naqu', postalCode: '852000' },
    { cityNameCn: '阿里地区', cityNameEn: 'Ngari', cityNamePinyin: 'Ali', postalCode: '859000' },
  ],
  '宁夏回族自治区': [
    { cityNameCn: '银川市', cityNameEn: 'Yinchuan', cityNamePinyin: 'Yinchuan', postalCode: '750000' },
    { cityNameCn: '石嘴山市', cityNameEn: 'Shizuishan', cityNamePinyin: 'Shizuishan', postalCode: '753000' },
    { cityNameCn: '吴忠市', cityNameEn: 'Wuzhong', cityNamePinyin: 'Wuzhong', postalCode: '751100' },
    { cityNameCn: '固原市', cityNameEn: 'Guyuan', cityNamePinyin: 'Guyuan', postalCode: '756000' },
    { cityNameCn: '中卫市', cityNameEn: 'Zhongwei', cityNamePinyin: 'Zhongwei', postalCode: '755000' },
  ],
  '新疆维吾尔自治区': [
    { cityNameCn: '乌鲁木齐市', cityNameEn: 'Urumqi', cityNamePinyin: 'Wulumuqi', postalCode: '830000' },
    { cityNameCn: '克拉玛依市', cityNameEn: 'Karamay', cityNamePinyin: 'Kelamayi', postalCode: '834000' },
    { cityNameCn: '吐鲁番市', cityNameEn: 'Turpan', cityNamePinyin: 'Tulufan', postalCode: '838000' },
    { cityNameCn: '哈密市', cityNameEn: 'Hami', cityNamePinyin: 'Hami', postalCode: '839000' },
    { cityNameCn: '昌吉回族自治州', cityNameEn: 'Changji', cityNamePinyin: 'Changji', postalCode: '831100' },
    { cityNameCn: '博尔塔拉蒙古自治州', cityNameEn: 'Bortala', cityNamePinyin: 'Boertala', postalCode: '833400' },
    { cityNameCn: '巴音郭楞蒙古自治州', cityNameEn: 'Bayingol', cityNamePinyin: 'Bayinguoleng', postalCode: '841000' },
    { cityNameCn: '阿克苏地区', cityNameEn: 'Aksu', cityNamePinyin: 'Akesu', postalCode: '843000' },
    { cityNameCn: '克孜勒苏柯尔克孜自治州', cityNameEn: 'Kizilsu', cityNamePinyin: 'Kezilesu', postalCode: '845350' },
    { cityNameCn: '喀什地区', cityNameEn: 'Kashgar', cityNamePinyin: 'Kashi', postalCode: '844000' },
    { cityNameCn: '和田地区', cityNameEn: 'Hotan', cityNamePinyin: 'Hetian', postalCode: '848000' },
    { cityNameCn: '伊犁哈萨克自治州', cityNameEn: 'Ili', cityNamePinyin: 'Yili', postalCode: '835000' },
    { cityNameCn: '塔城地区', cityNameEn: 'Tacheng', cityNamePinyin: 'Tacheng', postalCode: '834700' },
    { cityNameCn: '阿勒泰地区', cityNameEn: 'Altay', cityNamePinyin: 'Aletai', postalCode: '836500' },
  ],
}

// 直辖市下辖区数据 (level=3)
const districtsByMunicipality = {
  '北京市': [
    { cityNameCn: '东城区', cityNamePinyin: 'Dongcheng', postalCode: '100010' },
    { cityNameCn: '西城区', cityNamePinyin: 'Xicheng', postalCode: '100032' },
    { cityNameCn: '朝阳区', cityNamePinyin: 'Chaoyang', postalCode: '100020' },
    { cityNameCn: '丰台区', cityNamePinyin: 'Fengtai', postalCode: '100071' },
    { cityNameCn: '石景山区', cityNamePinyin: 'Shijingshan', postalCode: '100043' },
    { cityNameCn: '海淀区', cityNamePinyin: 'Haidian', postalCode: '100089' },
    { cityNameCn: '门头沟区', cityNamePinyin: 'Mentougou', postalCode: '102300' },
    { cityNameCn: '房山区', cityNamePinyin: 'Fangshan', postalCode: '102488' },
    { cityNameCn: '通州区', cityNamePinyin: 'Tongzhou', postalCode: '101100' },
    { cityNameCn: '顺义区', cityNamePinyin: 'Shunyi', postalCode: '101300' },
    { cityNameCn: '昌平区', cityNamePinyin: 'Changping', postalCode: '102200' },
    { cityNameCn: '大兴区', cityNamePinyin: 'Daxing', postalCode: '102600' },
    { cityNameCn: '怀柔区', cityNamePinyin: 'Huairou', postalCode: '101400' },
    { cityNameCn: '平谷区', cityNamePinyin: 'Pinggu', postalCode: '101200' },
    { cityNameCn: '密云区', cityNamePinyin: 'Miyun', postalCode: '101500' },
    { cityNameCn: '延庆区', cityNamePinyin: 'Yanqing', postalCode: '102100' },
  ],
  '上海市': [
    { cityNameCn: '黄浦区', cityNamePinyin: 'Huangpu', postalCode: '200001' },
    { cityNameCn: '徐汇区', cityNamePinyin: 'Xuhui', postalCode: '200030' },
    { cityNameCn: '长宁区', cityNamePinyin: 'Changning', postalCode: '200050' },
    { cityNameCn: '静安区', cityNamePinyin: 'Jingan', postalCode: '200040' },
    { cityNameCn: '普陀区', cityNamePinyin: 'Putuo', postalCode: '200333' },
    { cityNameCn: '虹口区', cityNamePinyin: 'Hongkou', postalCode: '200080' },
    { cityNameCn: '杨浦区', cityNamePinyin: 'Yangpu', postalCode: '200082' },
    { cityNameCn: '闵行区', cityNamePinyin: 'Minhang', postalCode: '201100' },
    { cityNameCn: '宝山区', cityNamePinyin: 'Baoshan', postalCode: '201900' },
    { cityNameCn: '嘉定区', cityNamePinyin: 'Jiading', postalCode: '201800' },
    { cityNameCn: '浦东新区', cityNamePinyin: 'Pudong', postalCode: '200120' },
    { cityNameCn: '金山区', cityNamePinyin: 'Jinshan', postalCode: '201500' },
    { cityNameCn: '松江区', cityNamePinyin: 'Songjiang', postalCode: '201600' },
    { cityNameCn: '青浦区', cityNamePinyin: 'Qingpu', postalCode: '201700' },
    { cityNameCn: '奉贤区', cityNamePinyin: 'Fengxian', postalCode: '201400' },
    { cityNameCn: '崇明区', cityNamePinyin: 'Chongming', postalCode: '202150' },
  ],
  '天津市': [
    { cityNameCn: '和平区', cityNamePinyin: 'Heping', postalCode: '300041' },
    { cityNameCn: '河东区', cityNamePinyin: 'Hedong', postalCode: '300171' },
    { cityNameCn: '河西区', cityNamePinyin: 'Hexi', postalCode: '300202' },
    { cityNameCn: '南开区', cityNamePinyin: 'Nankai', postalCode: '300100' },
    { cityNameCn: '河北区', cityNamePinyin: 'Hebei', postalCode: '300143' },
    { cityNameCn: '红桥区', cityNamePinyin: 'Hongqiao', postalCode: '300131' },
    { cityNameCn: '东丽区', cityNamePinyin: 'Dongli', postalCode: '300300' },
    { cityNameCn: '西青区', cityNamePinyin: 'Xiqing', postalCode: '300380' },
    { cityNameCn: '津南区', cityNamePinyin: 'Jinnan', postalCode: '300350' },
    { cityNameCn: '北辰区', cityNamePinyin: 'Beichen', postalCode: '300400' },
    { cityNameCn: '武清区', cityNamePinyin: 'Wuqing', postalCode: '301700' },
    { cityNameCn: '宝坻区', cityNamePinyin: 'Baodi', postalCode: '301800' },
    { cityNameCn: '滨海新区', cityNamePinyin: 'Binhai', postalCode: '300450' },
    { cityNameCn: '宁河区', cityNamePinyin: 'Ninghe', postalCode: '301500' },
    { cityNameCn: '静海区', cityNamePinyin: 'Jinghai', postalCode: '301600' },
    { cityNameCn: '蓟州区', cityNamePinyin: 'Jizhou', postalCode: '301900' },
  ],
  '重庆市': [
    { cityNameCn: '渝中区', cityNamePinyin: 'Yuzhong', postalCode: '400010' },
    { cityNameCn: '大渡口区', cityNamePinyin: 'Dadukou', postalCode: '400080' },
    { cityNameCn: '江北区', cityNamePinyin: 'Jiangbei', postalCode: '400020' },
    { cityNameCn: '沙坪坝区', cityNamePinyin: 'Shapingba', postalCode: '400030' },
    { cityNameCn: '九龙坡区', cityNamePinyin: 'Jiulongpo', postalCode: '400050' },
    { cityNameCn: '南岸区', cityNamePinyin: 'Nanan', postalCode: '400060' },
    { cityNameCn: '北碚区', cityNamePinyin: 'Beibei', postalCode: '400700' },
    { cityNameCn: '渝北区', cityNamePinyin: 'Yubei', postalCode: '401120' },
    { cityNameCn: '巴南区', cityNamePinyin: 'Banan', postalCode: '401320' },
    { cityNameCn: '涪陵区', cityNamePinyin: 'Fuling', postalCode: '408000' },
    { cityNameCn: '万州区', cityNamePinyin: 'Wanzhou', postalCode: '404000' },
    { cityNameCn: '黔江区', cityNamePinyin: 'Qianjiang', postalCode: '409000' },
    { cityNameCn: '长寿区', cityNamePinyin: 'Changshou', postalCode: '401220' },
    { cityNameCn: '江津区', cityNamePinyin: 'Jiangjin', postalCode: '402260' },
    { cityNameCn: '合川区', cityNamePinyin: 'Hechuan', postalCode: '401520' },
    { cityNameCn: '永川区', cityNamePinyin: 'Yongchuan', postalCode: '402160' },
  ],
}

async function initChinaCities() {
  const db = getDatabase()
  const countryCode = 'CN'
  
  console.log('🚀 开始初始化中国城市数据...')
  
  // 1. 先检查是否已有中国城市数据
  const existingCount = await db.prepare(
    'SELECT COUNT(*) as count FROM cities WHERE country_code = ?'
  ).get(countryCode)
  
  if (existingCount && existingCount.count > 0) {
    console.log(`⚠️  已存在 ${existingCount.count} 条中国城市数据`)
    console.log('是否要更新拼音和邮编数据？(将更新现有记录)')
    
    // 更新现有数据的拼音和邮编
    let updatedCount = 0
    
    // 更新省级数据
    for (const province of provinces) {
      const result = await db.prepare(`
        UPDATE cities 
        SET city_name_pinyin = ?, postal_code = ?, city_name_en = ?
        WHERE country_code = ? AND city_name_cn = ? AND level = 1
      `).run(
        province.cityNamePinyin,
        province.postalCode,
        province.cityNameEn,
        countryCode,
        province.cityNameCn
      )
      if (result.changes > 0) updatedCount++
    }
    
    // 更新地级市数据
    for (const [provinceName, cities] of Object.entries(citiesByProvince)) {
      for (const city of cities) {
        const result = await db.prepare(`
          UPDATE cities 
          SET city_name_pinyin = ?, postal_code = ?, city_name_en = ?
          WHERE country_code = ? AND city_name_cn = ? AND level = 2
        `).run(
          city.cityNamePinyin,
          city.postalCode,
          city.cityNameEn,
          countryCode,
          city.cityNameCn
        )
        if (result.changes > 0) updatedCount++
      }
    }
    
    // 更新直辖市区县数据
    for (const [municipalityName, districts] of Object.entries(districtsByMunicipality)) {
      for (const district of districts) {
        const result = await db.prepare(`
          UPDATE cities 
          SET city_name_pinyin = ?, postal_code = ?
          WHERE country_code = ? AND city_name_cn = ? AND level = 3
        `).run(
          district.cityNamePinyin,
          district.postalCode,
          countryCode,
          district.cityNameCn
        )
        if (result.changes > 0) updatedCount++
      }
    }
    
    console.log(`✅ 更新了 ${updatedCount} 条城市数据的拼音和邮编`)
    return
  }
  
  // 2. 插入省级数据
  console.log('📍 插入省级行政区...')
  const provinceIdMap = {}
  
  for (const province of provinces) {
    const result = await db.prepare(`
      INSERT INTO cities (
        country_code, city_code, city_name_cn, city_name_en, city_name_pinyin,
        parent_id, level, postal_code, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).get(
      countryCode,
      province.cityCode,
      province.cityNameCn,
      province.cityNameEn,
      province.cityNamePinyin,
      0,
      1,
      province.postalCode,
      'active'
    )
    provinceIdMap[province.cityNameCn] = result.id
  }
  console.log(`   ✓ 插入 ${provinces.length} 个省级行政区`)
  
  // 3. 插入地级市数据
  console.log('📍 插入地级市...')
  let cityCount = 0
  const cityIdMap = {}
  
  for (const [provinceName, cities] of Object.entries(citiesByProvince)) {
    const parentId = provinceIdMap[provinceName] || 0
    
    for (const city of cities) {
      const result = await db.prepare(`
        INSERT INTO cities (
          country_code, city_name_cn, city_name_en, city_name_pinyin,
          parent_id, level, postal_code, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `).get(
        countryCode,
        city.cityNameCn,
        city.cityNameEn,
        city.cityNamePinyin,
        parentId,
        2,
        city.postalCode,
        'active'
      )
      cityIdMap[city.cityNameCn] = result.id
      cityCount++
    }
  }
  console.log(`   ✓ 插入 ${cityCount} 个地级市`)
  
  // 4. 插入直辖市区县数据
  console.log('📍 插入直辖市区县...')
  let districtCount = 0
  
  for (const [municipalityName, districts] of Object.entries(districtsByMunicipality)) {
    const parentId = provinceIdMap[municipalityName] || 0
    
    for (const district of districts) {
      await db.prepare(`
        INSERT INTO cities (
          country_code, city_name_cn, city_name_pinyin,
          parent_id, level, postal_code, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        countryCode,
        district.cityNameCn,
        district.cityNamePinyin,
        parentId,
        3,
        district.postalCode,
        'active'
      )
      districtCount++
    }
  }
  console.log(`   ✓ 插入 ${districtCount} 个直辖市区县`)
  
  const totalCount = provinces.length + cityCount + districtCount
  console.log(`\n✅ 中国城市数据初始化完成！共 ${totalCount} 条记录`)
  console.log('   - 省级行政区: ' + provinces.length)
  console.log('   - 地级市: ' + cityCount)
  console.log('   - 直辖市区县: ' + districtCount)
}

// 主函数
async function main() {
  try {
    await initChinaCities()
    process.exit(0)
  } catch (error) {
    console.error('❌ 初始化失败:', error)
    process.exit(1)
  }
}

main()
