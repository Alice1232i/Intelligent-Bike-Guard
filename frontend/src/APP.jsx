import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Settings, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Video, 
  Image as ImageIcon, 
  Camera, 
  BarChart2, 
  Shield,
  FileText,
  Download,
  X,
  Volume2,
  VolumeX,
  Cpu,
  Wifi,
  Layers,
  Save,
  Trash2,
  Upload,
  Aperture,
  RotateCcw,
  Eye,
  Grid,
  EyeOff,
  User,
  Lock,
  LogOut,
  ArrowRight,
  Radio,      // 新增：代表RFID
  Signal,     // 新增：代表信号
  Zap,        // 新增：代表融合/电池
  Scan,       // 新增：代表扫描
  CreditCard, // 新增：代表身份卡
  UserCheck   // 新增：代表验证通过
} from 'lucide-react';
import axios from 'axios';

// --- 全局常量 ---
// 登录凭证（部署时请替换为实际账号密码，或改为调用后端鉴权接口）
const AUTH_USERNAME = 'your-username-here';
const AUTH_PASSWORD = 'your-password-here';

const EMPTY_DETECTION = {
  boxes: [],
  fps: 0,
  latency: 0
};

// --- 模拟 RFID 数据池 (比赛演示用) ---
const MOCK_RFID_DATABASE = [
  { id: 'RFID-7782', name: '张伟', company: '美团专送', score: 98, plate: 'A·77821', avatarColor: 'bg-yellow-500' },
  { id: 'RFID-9921', name: '李强', company: '饿了么', score: 85, plate: 'A·99212', avatarColor: 'bg-blue-500' },
  { id: 'RFID-3345', name: '王芳', company: '达达快送', score: 92, plate: 'A·33456', avatarColor: 'bg-green-500' },
  { id: 'RFID-1102', name: '赵杰', company: '美团专送', score: 76, plate: 'A·11029', avatarColor: 'bg-yellow-600' },
  { id: 'RFID-5561', name: '未知骑手', company: '非注册', score: 0, plate: '无牌照', avatarColor: 'bg-gray-500' },
];

// --- 组件：SVG 图表 (保持不变) ---
const SimpleLineChart = ({ data, color = "#3B82F6" }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="3" points={points} vectorEffect="non-scaling-stroke" />
      <polygon fill={color} fillOpacity="0.1" points={`0,100 ${points} 100,100`} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const SimpleDonutChart = ({ value, total, color = "#10B981", label, theme }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const radius = 35; 
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const trackColor = theme === 'dark' ? '#374151' : '#E5E7EB';
  const textColor = theme === 'dark' ? '#D1D5DB' : '#374151';
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r={radius} fill="transparent" stroke={trackColor} strokeWidth="6" />
          <circle cx="50%" cy="50%" r={radius} fill="transparent" stroke={color} strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-500 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-lg font-bold" style={{ color: textColor }}>{Math.round(percentage)}%</span>
        </div>
      </div>
      <span className="text-[10px] text-gray-500 mt-1">{label}</span>
    </div>
  );
};

// --- 组件：抓拍卡片组件 ---
const SnapshotCard = ({ snapshot, onDownload,onPreview, theme }) => (
  <div className={`min-w-[180px] border rounded-lg shadow-sm p-2 flex flex-col gap-2 animate-fadeIn hover:shadow-md transition-shadow ${
    theme === 'dark' ? 'bg-gray-800 border-red-900/50' : 'bg-white border-red-100'
  }`}>
    <div className="relative aspect-video bg-gray-900 rounded overflow-hidden group cursor-pointer" onClick={() => onPreview(snapshot)}>
      <img
        src={snapshot.imgUrl}
        alt="抓拍图像"
        className="w-full h-full object-cover transition-transfrom duration-500 group-hover:scale-100"
        />
      {/* 新增：RFID 标签水印 */}
      {snapshot.rfidTag && (
        <div className="absolute top-1 left-1 bg-purple-600/90 text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm border border-purple-400/30">
          <Radio size={8} /> {snapshot.rfidTag}
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button 
           onClick={(e) => { e.stopPropagation(); onPreview && onPreview(snapshot); }} 
           className="p-2 bg-white/20 backdrop-blur rounded-full text-white hover:bg-blue-600 transition-colors"
           title="预览抓拍"
         >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(snapshot); }}
            className="p-2 bg-white/20 backdrop-blur rounded-full text-white hover:bg-green-600 transition-colors"
            title="下载图像"
          >
            <Download size={16} />
          </button>
            </div>
      <div className="absolute top-1 right-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm">{snapshot.conf}</div>
    </div>
    <div className="flex justify-between items-end">
      <div>
        <div className={`text-xs font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{snapshot.time}</div>
        <div className="text-[10px] text-gray-500 flex items-center gap-1">
          {snapshot.rfidTag ? (
            <><Radio size={10} className="text-purple-500"/> RFID锁定</>
          ) : '仅视觉识别'}
        </div>
      </div>
      <div className="text-[10px] font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">违规</div>
    </div>
  </div>
);

// --- 组件：大图预览灯箱 ---
const ImageLightbox = ({ snapshot, onClose }) => {
  if (!snapshot) return null;
  return (
    <div 
      className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors z-[210]"
      >
        <X size={24} />
      </button>
      <div className="max-w-5xl max-h-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <img 
            src={snapshot.imgUrl} 
            alt="Full View" 
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-gray-700"
          />
          {/* 详情页也展示融合数据 */}
          {snapshot.rfidInfo && (
             <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-md p-3 rounded border border-purple-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                      {snapshot.rfidInfo.name[0]}
                   </div>
                   <div className="text-left">
                      <div className="text-white text-sm font-bold flex items-center gap-2">
                         {snapshot.rfidInfo.name} 
                         <span className="text-xs bg-purple-500/20 text-purple-300 px-1.5 rounded">{snapshot.rfidInfo.company}</span>
                      </div>
                      <div className="text-gray-400 text-xs">ID: {snapshot.rfidTag} | 信用分: {snapshot.rfidInfo.score}</div>
                   </div>
                </div>
                <div className="text-right">
                    <div className="text-red-400 font-bold text-sm">确认违规</div>
                    <div className="text-gray-500 text-xs">{snapshot.time}</div>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- 组件：抓拍画廊模态框 (Gallery Modal) ---
const SnapshotGalleryModal = ({ isOpen, onClose, snapshots, onDownload, onPreview, theme }) => {
  const [filter, setFilter] = useState('all');

  if (!isOpen) return null;
  const filteredSnapshots = snapshots.filter(snap => {
    if (filter === 'all') return true;
    const now = Date.now();
    const diff = now - snap.id; 
    if (filter === '1h') return diff < 60 * 60 * 1000;
    if (filter === '24h') return diff < 24 * 60 * 60 * 1000;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className={`w-full max-w-6xl h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-gray-900 border border-gray-700' : 'bg-white'}`}>
        
        <div className={`px-6 py-4 border-b flex justify-between items-center ${theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Camera size={24} className="text-blue-500"/>
            </div>
            <div>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                违规融合数据库
              </h2>
              <p className="text-xs text-gray-500">已存档 {snapshots.length} 条视觉+射频双重验证数据</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex p-1 rounded-lg border ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100'}`}>
              {[ { id: 'all', label: '全部' }, { id: '1h', label: '近1小时' }, { id: '24h', label: '近24小时' } ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFilter(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    filter === opt.id 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : (theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black')
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto p-6 scrollbar-thin ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
          {filteredSnapshots.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
              <Camera size={64} className="mb-4 stroke-1"/>
              <p className="text-lg">暂无符合条件的抓拍记录</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredSnapshots.map(snap => (
                <div key={snap.id} className="transform hover:-translate-y-1 transition-transform duration-300">
                   <SnapshotCard 
                      snapshot={snap} 
                      onDownload={onDownload} 
                      onPreview={onPreview}
                      theme={theme} 
                   />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- 组件：登录界面 ---
const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
        onLogin();
      } else {
        setError('用户名或密码错误 ，请重试。');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-gray-900 flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] rounded-full bg-purple-600/10 blur-[80px]" />
      </div>

      <div className="w-full max-w-md bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl p-8 relative animate-fadeIn">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-4">
            <Shield size={32} />
          </div>
          {/* 修改1：改回原名 */}
          <h1 className="text-2xl font-bold text-white tracking-tight">数智骑卫 · 外卖骑手行为治理平台</h1>
          <p className="text-gray-400 text-sm mt-2">RFID & AI Fusion Security System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Account</label>
            <div className="relative group">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-600"
                placeholder="请输入用户名"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-600"
                placeholder="请输入密码"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg animate-pulse">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-all transform active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                正在验证...
              </>
            ) : (
              <>登录系统 <ArrowRight size={18} /></>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">数智骑卫 v2.0 | RFID 模组已启用</p>
        </div>
      </div>
    </div>
  );
};

// --- 组件：设置模态框  ---
const SettingsModal = ({ isOpen, onClose,onSave, config, setConfig, theme }) => {
  const [activeTab, setActiveTab] = useState('general');

  if (!isOpen) return null;

  const TabButton = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 w-full px-4 py-3 text-sm font-medium transition-colors ${
        activeTab === id 
          ? (theme === 'dark' ? 'bg-gray-700 text-blue-400 border-r-2 border-blue-400' : 'bg-blue-50 text-blue-600 border-r-2 border-blue-600')
          : (theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-50')
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[500px] ${theme === 'dark' ? 'bg-gray-900 text-gray-100 border border-gray-700' : 'bg-white text-gray-800'}`}>
        {/* Sidebar */}
        <div className={`w-full md:w-64 border-r ${theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'}`}>
          <div className="p-4 border-b border-gray-200/10 mb-2">
            <h3 className="font-bold text-lg">系统设置</h3>
            <p className="text-xs text-gray-500">v2.1.0 (RFID Enabled)</p>
          </div>
          <nav className="space-y-1">
            <TabButton id="general" icon={Settings} label="通用设置" />
            <TabButton id="rfid" icon={Radio} label="射频识别 (RFID)" /> 
            <TabButton id="model" icon={Cpu} label="视觉模型" />
            <TabButton id="network" icon={Wifi} label="网络与存储" />
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          <div className={`flex justify-between items-center p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
            <h2 className="font-semibold text-lg capitalize">{activeTab} Configuration</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-500/10 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {activeTab === 'general' && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <span className="block font-medium">语音劝导 (Voice AI)</span>
                  <span className="text-xs text-gray-500">主动播报“请佩戴头盔”</span>
                </div>
                <button
                  onClick={() => setConfig({ ...config, voiceEnabled: !config.voiceEnabled })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${config.voiceEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${config.voiceEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="block font-medium">深色模式</span>
                  <span className="text-xs text-gray-500">推荐在夜间或控制中心使用</span>
                </div>
                <button
                  onClick={() => setConfig({ ...config, darkMode: !config.darkMode })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${config.darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${config.darkMode ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </>
            )}

            {/* 新增 RFID 设置项 */}
            {activeTab === 'rfid' && (
              <div className="space-y-4 animate-fadeIn">
                 <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5">
                   <div className="flex items-center gap-2 text-purple-600 font-bold mb-1">
                      <Radio size={18} />
                      融合感知增强
                   </div>
                   <p className="text-xs opacity-70">
                     启用后，系统将尝试匹配检测框与附近的 UHF RFID 标签，以获取骑手身份信息。
                   </p>
                 </div>

                 <div className="flex items-center justify-between">
                    <div>
                      <span className="block font-medium">启用 RFID 扫描</span>
                      <span className="text-xs text-gray-500">实时读取 900MHz 标签</span>
                    </div>
                    <button
                      onClick={() => setConfig({ ...config, rfidEnabled: !config.rfidEnabled })}
                      className={`w-12 h-6 rounded-full transition-colors relative ${config.rfidEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${config.rfidEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">信号强度阈值 (RSSI)</label>
                    <input 
                      type="range" 
                      min="-90" 
                      max="-30" 
                      defaultValue="-60"
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600" 
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>-90dBm (灵敏)</span>
                      <span>-30dBm (精准)</span>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'model' && (
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-sm font-medium">模型版本 (Fusion Model)</label>
                    <select 
                      defaultValue="YOLOv8s-Fusion (Vision+RF)"
                      className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                      onChange={(e) => setConfig({...config, modelVersion: e.target.value})}
                    >
                      <option>YOLOv8s-Fusion (Vision+RF)</option>
                      <option>YOLOv8s (Small) -Eca注意力2s版本</option>
                      <option>YOLOv8s (Small) -无eca注意力1s版本</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-sm font-medium">置信度阈值 (Confidence)</label>
                    <input 
                      type="number" 
                      min="0.1" 
                      max="1.0" 
                      step="0.05" 
                      value={config.modelConfThreshold || 0.5}
                      onChange={(e) => setConfig({...config, modelConfThreshold: parseFloat(e.target.value)})}
                      className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                    />
                 </div>
              </div>
            )}
             
             {activeTab === 'network' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="space-y-2"> 
                    <label className="text-sm font-medium">网络流地址</label>
                    <input
                        type="text"
                        placeholder="输入流地址"
                        value={config.cameraUrl}
                        onChange={(e) => setConfig({...config, cameraUrl: e.target.value})}
                        className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                      />
                  </div>
                </div>
              )}
          </div>
          
          <div className={`p-4 border-t flex justify-end gap-3 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors text-gray-500">取消</button>
            <button onClick={onSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Save size={16} /> 保存更改
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 主应用组件 ---
export default function HelmetDetectionSystem() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    const storedLogin = localStorage.getItem('app_is_logged_in');
    if (storedLogin === 'true') {
      setIsLoggedIn(true);
    }
  }, []);
   const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    localStorage.setItem('app_is_logged_in', 'true');
  };
  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('app_is_logged_in');
  };

  const [config, setConfig] = useState({
    darkMode: false,
    soundEnabled: true,
    autoSave: true,
    heatmapMode: false,
    modelVersion: 'YOLOv8s-Fusion (Vision+RF)',
    inferenceDevice: 'GPU (CUDA) - RTX 5060',
    modelConfThreshold: 0.5,
    cameraUrl: '',
    voiceEnabled: true,
    rfidEnabled: true // 默认开启 RFID 
  });
  
  const lastSnapshotTimeRef = useRef(0);
  const uniqueIdsRef = useRef(new Map());
  const imgRef = useRef(null);  
  
  const [showSettings, setShowSettings] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [inputSource, setInputSource] = useState('camera');
  const [confThreshold, setConfThreshold] = useState(0.50);
  const [iouThreshold, setIouThreshold] = useState(0.45);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const hasDetectedRef = useRef(false);
  const [showGallery, setShowGallery] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState(null);
  const lastSpeechTimeRef = useRef(0);
  const [privacyMode, setPrivacyMode] = useState(false);
  
  // RFID 模拟状态
  const [rfidSignalStrength, setRfidSignalStrength] = useState(0);
  // 新增：实时 RFID 列表状态
  const [activeRfidItems, setActiveRfidItems] = useState([]);
  
  // 新增：缓存每一帧的 RFID 检测数据，用于节流更新 UI
  const latestRfidDataRef = useRef([]);

  const [stats, setStats] = useState({ fps: 0, totalCount: 0, helmetCount: 0, noHelmetCount: 0, violationRate: 0, latency: 0 });
  const [logs, setLogs] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [trendData, setTrendData] = useState(Array(20).fill(5));
  const [boxes, setBoxes] = useState([]);
  const [isBeeping, setIsBeeping] = useState(false);

  useEffect(() => {
    // 修改2：网页 Title 改回原名
    document.title = "数智骑卫 · 外卖骑手行为治理平台"; 
  }, []);

  // --- 模拟 RFID 信号波动 ---
  useEffect(() => {
    if (isDetecting && config.rfidEnabled) {
      const interval = setInterval(() => {
        // 随机信号波动，模拟硬件真实感
        setRfidSignalStrength(Math.floor(Math.random() * 40) + 60); 
      }, 800);
      return () => clearInterval(interval);
    } else {
      setRfidSignalStrength(0);
    }
  }, [isDetecting, config.rfidEnabled]);

  // --- 🆕 独立定时器：专门用于更新 RFID 列表 UI (解决闪烁问题) ---
  useEffect(() => {
    if (!isDetecting || !config.rfidEnabled) return;

    // 每 800ms 更新一次右侧列表，而不是每一帧都更新
    const uiInterval = setInterval(() => {
       const rawItems = latestRfidDataRef.current;
       
       if (rawItems.length > 0) {
          // 这里再进行模拟的信号强度波动
          const displayItems = rawItems.map(item => ({
             ...item,
             rssi: Math.floor(Math.random() * 30) + -70,
             lastSeenStr: new Date().toLocaleTimeString()
          }));
          setActiveRfidItems(displayItems);
       } else {
          // 如果最近没有检测到数据，稍微延迟一点清空，增加稳定性
          setActiveRfidItems([]); 
       }
    }, 800); 

    return () => clearInterval(uiInterval);
  }, [isDetecting, config.rfidEnabled]);

  const handleSaveSettings = () => {
    setShowSettings(false); 
    addSystemLog('系统', `配置已保存: 融合感知模式 ${config.rfidEnabled ? '已开启' : '已关闭'}`, '成功');
  };

  useEffect(() => {
    if (inputSource === 'video' && videoRef.current && uploadedFile) {
      if (isDetecting) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("自动播放被阻止或失败，请手动点击播放:", error);
          });
        }
      } else {
        videoRef.current.pause();
      }
    }
  }, [isDetecting, inputSource, uploadedFile]);

  useEffect(() => {
    let isCancelled = false;
    let isProcessing = false;
    let frameCount = 0;
    let lastFpsUpdate = Date.now();

    const loop = async () => {
      if (!isDetecting || isCancelled) return;
      if (isProcessing) {
          requestAnimationFrame(loop);
          return;
      }
      if (inputSource === 'image' && hasDetectedRef.current) return;

      isProcessing = true;
      try {
        let yoloResult = EMPTY_DETECTION;
        if (inputSource === 'camera' && videoRef.current && videoRef.current.readyState === 4) {
          yoloResult = await runYoloDetectionOnVideo(videoRef.current);
        } 
        else if (inputSource === 'video' && videoRef.current && videoRef.current.readyState === 4) {
          if (!videoRef.current.paused) {
             yoloResult = await runYoloDetectionOnVideo(videoRef.current);
          }
        } 
        else if (inputSource === 'image' && uploadedImageUrl) {
          yoloResult = await runYoloDetectionOnImage(uploadedImageUrl);
          hasDetectedRef.current = true;
        }

        if (!isCancelled) {
          if (yoloResult && (yoloResult.boxes || yoloResult.latency)) {
             processDetectionResult(yoloResult);
             frameCount++;
             const currentTime = Date.now();
             if (currentTime - lastFpsUpdate >= 1000) {
               setStats(prev => ({ ...prev, fps: frameCount }));
               frameCount = 0;
               lastFpsUpdate = currentTime;
             }
          } else {
             // 如果检测结果为空，也需要清空缓存
             latestRfidDataRef.current = [];
          }
        }
      } catch (err) {
        console.error('检测循环出错:', err);
      } finally {
        isProcessing = false;
        if (!isCancelled) {
            requestAnimationFrame(loop);
        }
      }
    };

    if (isDetecting) {
      loop();
    } else {
      setBoxes([]);
      hasDetectedRef.current = false;
      setActiveRfidItems([]); // 停止时清空列表
      latestRfidDataRef.current = []; // 清空缓存
      setStats(prev => ({ ...prev, fps: 0, latency: 0 }));
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [isDetecting, inputSource, uploadedImageUrl, config, confThreshold, iouThreshold]);

  const runYoloDetectionOnVideo = async (videoElement) => {
    try {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 960;
      const scale = Math.min(1, MAX_WIDTH / videoElement.videoWidth);
      canvas.width = videoElement.videoWidth * scale;
      canvas.height = videoElement.videoHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.6);
      const base64WithoutHeader = base64.split(',')[1];

      const res = await axios.post(
        'http://localhost:8000/detect/video-frame',
        { base64: base64WithoutHeader },
        {
          params: {
            conf_threshold: config.modelConfThreshold,
            iou_threshold: iouThreshold,
            model_version: config.modelVersion
          },
          timeout: 8000
        }
      );

      if (res.data.status === 'success') {
        const { boxes, latency } = res.data.data;
        // 关键修改：在这里注入 RFID 模拟逻辑
        const enhancedBoxes = await injectRfidData(boxes);
        
        drawBoxesOnCanvas(enhancedBoxes, videoElement.videoWidth, videoElement.videoHeight);

        return {
          boxes: enhancedBoxes,
          latency: latency,
          fps: Math.round(1000 / latency)
        };
      } else {
        return EMPTY_DETECTION;
      }
    } catch (err) {
      // console.error(err); 
      // 避免刷屏报错
      return EMPTY_DETECTION;
    }
  };

  const runYoloDetectionOnImage = async (imageUrl) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append('file', blob, 'detect-image.jpg');
      formData.append('conf_threshold', config.modelConfThreshold);
      formData.append('iou_threshold', iouThreshold);
      formData.append('model_version', config.modelVersion);

      const res = await axios.post(
        'http://localhost:8000/detect/image',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 5000 }
      );

      if (res.data.status === 'success') {
        const { boxes, img_width, img_height, latency } = res.data.data;
        const enhancedBoxes = await injectRfidData(boxes);
        drawBoxesOnCanvas(enhancedBoxes, img_width, img_height);
        return { boxes: enhancedBoxes, latency: latency, fps: 1 };
      } else {
        return EMPTY_DETECTION;
      }
    } catch (err) {
      return EMPTY_DETECTION;
    }
  };

  // --- 模拟：为检测框注入 RFID 数据 ---
  const injectRfidData = async (boxes) => {
    if (!config.rfidEnabled || boxes.length === 0) return boxes;

    return boxes.map((box, index) => {
      // 只有 50% 的概率匹配到 RFID（模拟真实场景中的漏读或无标签）
      // 并且只有当置信度较高时才匹配
      if (Math.random() > 0.5 && parseFloat(box.conf) > 0.6) {
        // 随机取一个骑手信息
        const mockIdentity = MOCK_RFID_DATABASE[index % MOCK_RFID_DATABASE.length];
        return {
          ...box,
          rfidInfo: mockIdentity,
          isRfidVerified: true
        };
      }
      return box;
    });
  };

  // --- 绘制检测框 (HUD 升级版) ---
  const drawBoxesOnCanvas = (boxes, width, height) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (boxes.length === 0) return;

    boxes.forEach(box => {
      const x = (box.x / 100) * canvas.width;
      const y = (box.y / 100) * canvas.height;
      const w = (box.width / 100) * canvas.width;
      const h = (box.height / 100) * canvas.height;

      // 颜色定义
      let mainColor = '#00f0ff'; 
      if (box.type === 'no_helmet') mainColor = '#ff003c'; 
      else if (box.type === 'rider') mainColor = '#fcee0a'; 
      else if (box.type === 'helmet') mainColor = '#00ff41';
      
      // 如果有 RFID，使用特殊的紫色高亮
      if (box.isRfidVerified) {
         ctx.strokeStyle = '#a855f7'; // Purple-500
         ctx.shadowColor = '#a855f7';
      } else {
         ctx.strokeStyle = mainColor;
         ctx.shadowColor = mainColor;
      }
      
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 8;

      // 绘制四角框
      const cornerLen = Math.min(w, h) * 0.25;
      ctx.beginPath();
      // 左上
      ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
      // 右上
      ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
      // 右下
      ctx.moveTo(x + w, y + h - cornerLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cornerLen, y + h);
      // 左下
      ctx.moveTo(x + cornerLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - cornerLen);
      ctx.stroke();

      // --- RFID 增强显示 ---
      if (box.isRfidVerified && box.rfidInfo) {
         // 绘制连接线
         ctx.beginPath();
         ctx.moveTo(x + w, y + h/2);
         ctx.lineTo(x + w + 20, y + h/2 - 20);
         ctx.lineTo(x + w + 140, y + h/2 - 20);
         ctx.strokeStyle = '#a855f7';
         ctx.stroke();

         // 绘制信息卡片背景
         ctx.fillStyle = 'rgba(20, 0, 40, 0.8)';
         ctx.fillRect(x + w + 20, y + h/2 - 55, 120, 35);
         
         // 绘制 RFID 图标
         ctx.fillStyle = '#a855f7';
         ctx.font = 'bold 10px Arial';
         ctx.fillText("RFID 身份锁定", x + w + 25, y + h/2 - 40);
         
         // 绘制具体信息
         ctx.fillStyle = '#ffffff';
         ctx.font = '10px Arial';
         ctx.fillText(`${box.rfidInfo.name} | ${box.rfidInfo.company}`, x + w + 25, y + h/2 - 28);
      }

      // 普通标签
      ctx.shadowBlur = 0;
      const labelStartX = x;
      const labelStartY = y - 15;
      ctx.fillStyle = box.isRfidVerified ? '#a855f7' : mainColor;
      ctx.fillRect(labelStartX, labelStartY, 80, 15);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(box.label.toUpperCase(), labelStartX + 5, labelStartY + 10);
    });
  };

  const captureSnapshot = (violationBoxes) => {
    let sourceElement = null;
    let sourceWidth = 0;
    let sourceHeight = 0;
    if ((inputSource === 'camera' || inputSource === 'video') && videoRef.current) {
      sourceElement = videoRef.current;
      sourceWidth = videoRef.current.videoWidth;
      sourceHeight = videoRef.current.videoHeight;
    } 
    else if (inputSource === 'image' && imgRef.current) {
      sourceElement = imgRef.current;
      sourceWidth = imgRef.current.naturalWidth;
      sourceHeight = imgRef.current.naturalHeight;
    }
    if (!sourceElement || sourceWidth ===0 ) return;
    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceElement, 0, 0, sourceWidth, sourceHeight);
    
    // 抓拍图也画框
    violationBoxes.forEach(box => {
      const x = (box.x / 100) * sourceWidth;
      const y = (box.y / 100) * sourceHeight;
      const w = (box.width / 100) * sourceWidth;
      const h = (box.height / 100) * sourceHeight;
      ctx.strokeStyle = '#EF4121';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);
    });

    const imgUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    // 获取第一个违规框的 RFID 信息（如果有）
    const rfidInfo = violationBoxes[0].rfidInfo || null;

    const newSnapshot = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      conf: violationBoxes[0].conf || '0.00',
      location: inputSource === 'camera' ? '摄像头 A-01' : '检测文件',
      imgUrl: imgUrl,
      type: 'violation',
      rfidTag: rfidInfo ? rfidInfo.id : null, // 存入 RFID ID
      rfidInfo: rfidInfo // 存入完整信息
    };
    setSnapshots(prev => [newSnapshot, ...prev].slice(0, 20));
  };

  const handleDownloadSnapshot = (snapshot) => {
    const link = document.createElement('a');
    link.href = snapshot.imgUrl;
    link.download = `violation_${snapshot.rfidTag || 'unknown'}_${snapshot.time}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addSystemLog('抓拍', `已下载证据 ${snapshot.rfidTag ? `(含RFID:${snapshot.rfidTag})` : ''}`, '信息');
  }

  const processDetectionResult = (detectionResult) => {
    const { boxes: detectedBoxes, latency } = detectionResult;
    const filteredBoxes = detectedBoxes.filter(box => parseFloat(box.conf) >= confThreshold);
    
    const currentNoHelmetCount = filteredBoxes.filter(box => box.type === 'no_helmet').length;
    const currentHelmetCount = filteredBoxes.filter(box => box.type === 'helmet').length;

    // 统计 RFID 匹配数
    const rfidMatchedCount = filteredBoxes.filter(box => box.isRfidVerified).length;

    // --- 修改：不直接更新状态，而是存入 Ref，供定时器读取 ---
    // 提取纯数据对象，不要包含随机数生成逻辑
    const currentRfidItems = filteredBoxes
      .filter(box => box.isRfidVerified && box.rfidInfo)
      .map(box => ({
        ...box.rfidInfo,
        lastSeen: Date.now()
      }));
    latestRfidDataRef.current = currentRfidItems;
    // setActiveRfidItems(currentRfidItems); // 移除这行，避免高频刷新
    // ----------------------------------

    let newTotal = 0;     
    let newHelmet = 0;   
    let newNoHelmet = 0;  

    const idMap = uniqueIdsRef.current;
    filteredBoxes.forEach(box => {
      if (box.track_id !== null && box.track_id !== undefined) {
        const id = box.track_id;
        if (!idMap.has(id)) {
          idMap.set(id, box.type);
          newTotal++;
          if (box.type === 'helmet') newHelmet++;
          if (box.type === 'no_helmet') newNoHelmet++;
          
          // 如果是新出现的且有 RFID，写入日志
          if (box.isRfidVerified) {
             addSystemLog('射频', `识别骑手身份: ${box.rfidInfo.name} (${box.rfidInfo.company}) - ID:${box.rfidInfo.id}`, '成功');
          }
        }
      }
    });

    setBoxes(filteredBoxes);
    setStats(prev => {
      const updatedTotal = prev.totalCount + newTotal;
      const updatedHelmet = prev.helmetCount + newHelmet;
      const updatedNoHelmet = prev.noHelmetCount + newNoHelmet;
      return {
        ...prev,
        latency,
        totalCount: updatedTotal,
        helmetCount: updatedHelmet,
        noHelmetCount: updatedNoHelmet,
        violationRate: updatedTotal > 0 
          ? ((updatedNoHelmet / updatedTotal) * 100).toFixed(1) 
          : prev.violationRate
      };
    });

    if (currentNoHelmetCount > 0) {
      if (config.soundEnabled) {
        setIsBeeping(true);
        setTimeout(() => setIsBeeping(false), 200);
        speakWarning();
      }

      if (config.autoSave && (Date.now() - lastSnapshotTimeRef.current > 2000)) {
         const violations = filteredBoxes.filter(box => box.type === 'no_helmet');
         if (violations.length > 0) {
            captureSnapshot(violations);
            lastSnapshotTimeRef.current = Date.now();
         }
      }

      // 生成日志，如果有 RFID 则加注
      const rfidNote = rfidMatchedCount > 0 ? ` (已锁定 ${rfidMatchedCount} 人身份)` : '';
      const newLog = {
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        type: '违规警告',
        message: `检测到 ${currentNoHelmetCount} 人违规${rfidNote}`,
        location: inputSource === 'camera' ? '路口 A-01' : '文件'
      };
      // 避免重复日志刷屏
      if (logs.length === 0 || logs[0].message !== newLog.message || (Date.now() - logs[0].id > 3000)) {
         setLogs(prev => [newLog, ...prev].slice(0, 10));
      }
      
      setTrendData(prev => [...prev.slice(1), prev[prev.length-1] + currentNoHelmetCount]);
    } else if (filteredBoxes.length === 0) {
      setTrendData(prev => [...prev.slice(1), Math.max(0, prev[prev.length-1] - 1)]);
    }
  };

  const handleResetData = () => {
    setStats({ fps: 0, totalCount: 0, helmetCount: 0, noHelmetCount: 0, violationRate: 0, latency: 0 });
    setTrendData(Array(20).fill(5));
    uniqueIdsRef.current.clear();
    setSnapshots([]);
    setActiveRfidItems([]); // 清空实时列表
    addSystemLog('系统', '已重置所有数据', '警告');
  }

  const speakWarning = () => {
    if (!config.voiceEnabled) return;
    const now = Date.now();
    if (now - lastSpeechTimeRef.current < 5000) return;
    const msg = new SpeechSynthesisUtterance('检测到违规行为，请佩戴头盔');
    msg.lang = 'zh-CN';
    window.speechSynthesis.speak(msg);
    lastSpeechTimeRef.current = now;
  };
    
  const addSystemLog = (type, message, logType = '信息') => {
    const newLog = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      type: logType,
      message: `[${type}] ${message}`,
      location: '-'
    };
    setLogs(prev => [newLog, ...prev].slice(0, 10));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file.name);
      if (inputSource === 'video') {
        const videoUrl = URL.createObjectURL(file);
        setUploadedImageUrl(videoUrl);
        setBoxes([]);
        addSystemLog('文件', `加载视频: ${file.name}`);
        hasDetectedRef.current = false;
      }
      else {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImageUrl(event.target.result);
        setBoxes([]);
        hasDetectedRef.current = false;
        addSystemLog('文件', `加载图片: ${file.name}`);
      };
      reader.readAsDataURL(file);
    }
  };
  }
  const triggerFileUpload = () => {
    fileInputRef.current.click();
  };

  const handleExportLogs = () => {
    if (logs.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8," + logs.map(e => `${e.time},${e.type},${e.message}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = "rfid_system_logs.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearLogs = () => {
    setLogs([]); 
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLoginSuccess} />;
  }

  const themeClass = config.darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-800";
  const cardClass = config.darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100";
  const textMuted = config.darkMode ? "text-gray-400" : "text-gray-500";
  const textMain = config.darkMode ? "text-gray-100" : "text-gray-900";

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${themeClass}`}>
      <ImageLightbox
      snapshot={previewSnapshot}
      onClose={() => setPreviewSnapshot(null)}
      />
      <SnapshotGalleryModal
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        snapshots={snapshots}
        onDownload={handleDownloadSnapshot}
        onPreview={setPreviewSnapshot}
        theme={config.darkMode?'dark':'light'}    
      />
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        onSave={handleSaveSettings}
        config={config} 
        setConfig={setConfig} 
        theme={config.darkMode ? 'dark' : 'light'}
      />

      {/* 顶部导航 */}
      <header className={`border-b px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40 ${config.darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Shield size={24} />
          </div>
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${textMain} flex items-center gap-2`}>
              数智骑卫 · 外卖骑手行为治理平台
              {config.rfidEnabled && (
                <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full border border-purple-200">
                  RFID Fusion
                </span>
              )}
            </h1>
            <p className={`text-xs ${textMuted}`}>Challenge Cup Edition | Dev: chenzhilong</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${config.darkMode ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-green-50 text-green-700 border-green-100'}`}>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            视觉在线
          </div>
          {/* RFID 状态指示灯 */}
          <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${config.rfidEnabled ? (config.darkMode ? 'bg-purple-900/30 text-purple-400 border-purple-800' : 'bg-purple-50 text-purple-700 border-purple-100') : 'bg-gray-100 text-gray-400'}`}>
             {config.rfidEnabled ? <Wifi size={14} className="animate-pulse"/> : <Wifi size={14} className="opacity-50"/>}
             {config.rfidEnabled ? '射频模组' : '射频离线'}
          </div>

          <button onClick={() => setShowSettings(true)} className={`p-2 rounded-full transition-colors ${config.darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}>
            <Settings size={20} />
          </button>
          <button 
            onClick={handleLogout} 
            className={`p-2 rounded-full transition-colors ${config.darkMode ? 'text-red-400 hover:bg-red-900/30' : 'text-red-500 hover:bg-red-50'}`}
            title="退出登录"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左侧栏 */}
        <div className="lg:col-span-3 space-y-6">
          <div className={`rounded-xl shadow-sm border p-5 ${cardClass}`}>
            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${textMain}`}>
              <Activity size={18} className="text-blue-500" /> 控制中心
            </h2>
            
            <div className="mb-6">
              <label className={`text-sm font-medium mb-2 block ${textMuted}`}>输入源</label>
              <div className="grid grid-cols-3 gap-2">
                {['camera', 'video', 'image'].map(src => (
                   <button 
                    key={src}
                    onClick={() => { 
                      setIsDetecting(false); 
                      setInputSource(src);    
                      setUploadedFile(null); 
                      setBoxes([]);
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${inputSource === src ? 'bg-blue-500/10 border-blue-500 text-blue-600' : `${config.darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'} ${textMuted}`}`}
                  >
                    {src === 'video' && <Video size={20} className="mb-1" />}
                    {src === 'image' && <ImageIcon size={20} className="mb-1" />}
                    {src === 'camera' && <Camera size={20} className="mb-1" />}
                    <span className="text-xs capitalize">{src === 'camera' ? '实时监控' : src === 'video' ? '视频文件' : '图片检测'}</span>
                  </button>
                ))}
              </div>
            </div>

            {(inputSource === 'video' || inputSource === 'image') && (
              <div className="mb-6 animate-fadeIn">
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   onChange={handleFileUpload} 
                   accept={inputSource === 'video' ? "video/*" : "image/*"}
                   className="hidden" 
                 />
                 <div 
                   onClick={triggerFileUpload}
                   className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${config.darkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'}`}
                 >
                    {uploadedFile ? (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <FileText size={16} />
                        <span className="text-xs truncate max-w-[150px]">{uploadedFile}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <Upload size={20} />
                        <span className="text-xs">点击上传{inputSource === 'video' ? '视频' : '图片'}</span>
                      </div>
                    )}
                 </div>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className={textMuted}>Conf 阈值</span>
                  <span className="font-medium text-blue-600">{confThreshold}</span>
                </div>
                <input type="range" min="0" max="1" step="0.01" value={confThreshold} onChange={(e) => setConfThreshold(e.target.value)} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className={textMuted}>RFID 灵敏度</span>
                  <span className="font-medium text-purple-600">High</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-lg overflow-hidden flex">
                   <div className="h-full bg-purple-500 w-3/4 animate-pulse"></div>
                </div>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-lg ${config.darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <Aperture size={18} className={config.autoSave ? "text-blue-500" : "text-gray-400"} />
                    <div>
                      <span className={`block text-sm font-medium ${textMain}`}>智能抓拍</span>
                      <span className="text-[10px] text-gray-500">双重取证模式</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setConfig({...config, autoSave: !config.autoSave})}
                    className={`w-10 h-5 rounded-full transition-colors relative ${config.autoSave ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${config.autoSave ? 'left-6' : 'left-1'}`} />
                  </button>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200/50">
              <button 
                onClick={() => setIsDetecting(!isDetecting)}
                disabled={!isDetecting && (inputSource !== 'camera' && !uploadedFile)}
                className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all shadow-md ${
                  isDetecting 
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20' 
                    : ((inputSource === 'video' || inputSource === 'image') && !uploadedFile)
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isDetecting ? <><Pause size={20} /> 停止监测</> : <><Play size={20} /> 启动融合感知</>}
              </button>
            </div>
          </div>

          <div className={`rounded-xl shadow-sm border p-5 ${cardClass}`}>
             <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${textMain}`}><Cpu size={16} className="text-blue-500"/> 算力与硬件</h3>
             <div className="space-y-2 text-sm">
                <div className={`flex justify-between ${textMuted}`}><span>AI Model:</span> <span className="font-mono">YOLOv8-骑手识别</span></div>
                <div className={`flex justify-between ${textMuted}`}><span>RFID Reader:</span> <span className="font-mono text-purple-500">Impinj R2000</span></div>
                <div className={`flex justify-between ${textMuted}`}><span>Antenna:</span> <span className="font-mono">9dBi Circular</span></div>
                <div className={`flex justify-between ${textMuted}`}><span>Latency:</span> <span className="font-mono">{stats.latency}ms</span></div>
             </div>
          </div>
        </div>

        {/* 中间主要区域 */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          
          <div className="rounded-xl overflow-hidden shadow-lg relative aspect-video group bg-black border border-gray-800">
            {/* 视频层 */}
            {inputSource === 'camera' && (
              <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${privacyMode ? 'blur-md opacity-50' : ''}`}
                playsInline muted
              />
            )}
            {inputSource === 'video' && uploadedFile && (
              <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${privacyMode ? 'blur-md opacity-50' : ''}`}
                src={uploadedImageUrl}
                playsInline muted controlsList="nodownload" loop
                onLoadedMetadata={() => { if(isDetecting) videoRef.current.play(); }}
              />
            )}
            {inputSource === 'image' && uploadedImageUrl && (
              <img
                ref={imgRef}
                src={uploadedImageUrl}
                alt="上传图片"
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${privacyMode ? 'blur-md opacity-50' : ''}`}
              />
            )}

            {/* 空状态占位 */}
            {(inputSource === 'camera' && !isDetecting) || (!uploadedFile && (inputSource === 'video' || inputSource === 'image')) ? (
              <>
                <div className="absolute bottom-0 w-full h-1/3 bg-gray-700 transform skew-x-12 origin-bottom-left opacity-30"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-700 opacity-20 text-9xl font-black select-none">
                  FUSION
                </div>
              </>
            ) : null}

            {!isDetecting && (
              <div className="text-center text-gray-500 z-10 flex flex-col items-center absolute inset-0 justify-center">
                <div className="w-16 h-16 border-2 border-gray-600 rounded-full flex items-center justify-center mb-4 group-hover:border-blue-500 transition-colors">
                  <Play size={32} className="ml-1 group-hover:text-blue-500 transition-colors"/>
                </div>
                <p>等待启动融合感知系统...</p>
              </div>
            )}
            
            {/* HUD 覆盖层 */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-20" />

            {/* RFID 信号模拟动画层 (仅检测时显示) */}
            {isDetecting && config.rfidEnabled && (
              <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
                 <div className="bg-black/60 backdrop-blur border border-purple-500/30 rounded px-3 py-2 flex flex-col gap-1 w-32">
                    <div className="flex justify-between items-center text-[10px] text-purple-300">
                       <span className="flex items-center gap-1"><Signal size={10}/> SIGNAL</span>
                       <span>{rfidSignalStrength} dBm</span>
                    </div>
                    {/* 信号条动画 */}
                    <div className="flex gap-0.5 items-end h-6">
                       {[...Array(10)].map((_, i) => (
                          <div 
                            key={i} 
                            className={`w-2 bg-purple-500 transition-all duration-300 ${i < (rfidSignalStrength / 10) ? 'opacity-80' : 'opacity-20'}`}
                            style={{ height: `${Math.random() * 100}%` }}
                          />
                       ))}
                    </div>
                 </div>
              </div>
            )}

            {/* 顶部状态条 */}
            <div className="absolute top-4 right-4 flex gap-2 z-30">
              {isBeeping && <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-1"><Volume2 size={12}/> ALERT</div>}
              <div className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-mono border border-white/10">
                FPS: <span className="text-green-400 font-bold">{stats.fps}</span>
              </div>
            </div>
            
            {/* 底部工具栏 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2 bg-black/70 backdrop-blur rounded-full px-4 py-2 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setPrivacyMode(!privacyMode)}
                className={`p-2 rounded-full hover:bg-white/20 transition-colors ${privacyMode ? 'text-yellow-400 bg-white/10' : 'text-white'}`}
                >
                {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button 
                onClick={() => setConfig(c => ({...c, rfidEnabled: !c.rfidEnabled}))}
                className={`p-2 rounded-full hover:bg-white/20 transition-colors ${config.rfidEnabled ? 'text-purple-400 bg-white/10' : 'text-gray-400'}`} title="RFID 开关">
                <Radio size={18} />
              </button>
              <button 
                onClick={() => setConfig(c => ({...c, soundEnabled: !c.soundEnabled}))}
                className={`p-2 rounded-full hover:bg-white/20 text-white ${!config.soundEnabled ? 'text-gray-500' : ''}`} title="声音开关">
                {config.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            </div>
          </div>

          {/* 数据卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
               { label: '融合检测数', val: stats.totalCount, color: textMain, icon: Scan },
               { label: '规范佩戴', val: stats.helmetCount, color: 'text-green-500', icon: CheckCircle },
               { label: '违规未戴', val: stats.noHelmetCount, color: 'text-red-500', icon: AlertTriangle },
               { label: 'RFID锁定率', val: `${isDetecting ? '48.2' : 0}%`, color: 'text-purple-500', icon: Radio }, // 新增虚构指标
             ].map((item, i) => (
               <div key={i} className={`p-4 rounded-xl border shadow-sm flex flex-col justify-between ${cardClass}`}>
                 <span className={`text-xs font-medium uppercase tracking-wider flex items-center gap-1 ${textMuted}`}>
                    {item.icon && <item.icon size={12} />} {item.label}
                 </span>
                 <div className={`text-2xl font-bold mt-1 ${item.color}`}>{item.val}</div>
               </div>
             ))}
          </div>

          {/* 抓拍画廊预览 */}
          <div className={`rounded-xl shadow-sm border overflow-hidden flex flex-col ${cardClass}`}>
            <div className={`px-5 py-3 border-b flex justify-between items-center ${config.darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-gray-50'}`}>
              <h3 className={`text-sm font-semibold flex items-center gap-2 ${textMain}`}><Camera size={16} className="text-blue-500"/> 智能取证 (AI+RFID)</h3>
              {config.autoSave && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Auto-Save On</span>}
              <button 
                onClick={() => setShowGallery(true)} 
                className="text-xs text-blue-500 hover:text-blue-400 font-medium flex items-center gap-1 transition-colors"
              >
                <Grid size={14} /> 查看完整图库
              </button>
            </div>
            <div className={`p-4 min-h-[140px] flex gap-3 overflow-x-auto pb-4 scrollbar-thin ${config.darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
               {snapshots.length === 0 ? (
                 <div className={`w-full flex flex-col items-center justify-center py-4 border-2 border-dashed rounded-lg ${config.darkMode ? 'border-gray-700 text-gray-600' : 'border-gray-200 text-gray-400'}`}>
                    <Camera size={24} className="mb-2 opacity-50"/>
                    <span className="text-xs">等待抓拍数据...</span>
                 </div>
               ) : (
                 snapshots.map(snap => <SnapshotCard key={snap.id} snapshot={snap} onDownload={handleDownloadSnapshot} onPreview={setPreviewSnapshot} theme={config.darkMode ? 'dark' : 'light'} />)
               )}
            </div>
          </div>
        </div>

        {/* 右侧栏：数据与日志 */}
        <div className="lg:col-span-3 space-y-6">
           <div className={`rounded-xl shadow-sm border p-5 h-full flex flex-col ${cardClass}`}>
             <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold flex items-center gap-2 ${textMain}`}>
                  <BarChart2 size={18} className="text-blue-500"/> 治理看板
                  </h2>
                <button 
                  onClick={handleResetData} 
                  className={`p-2 rounded-full transition-colors ${config.darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                  title="重置"
                >
                  <RotateCcw size={16} /> 
                </button>
             </div>
             
             <div className="mb-6 flex justify-around">
                <SimpleDonutChart value={stats.helmetCount} total={stats.totalCount} color="#10B981" label="佩戴率" theme={config.darkMode ? 'dark' : 'light'} />
                <SimpleDonutChart value={stats.noHelmetCount} total={stats.totalCount} color="#EF4444" label="违规率" theme={config.darkMode ? 'dark' : 'light'} />
             </div>

             {/* 修改：降低图表高度 */}
             <div className="mb-4">
                <h4 className={`text-xs font-medium mb-3 ${textMuted}`}>违规趋势 (Real-time)</h4>
                <div className={`h-20 w-full rounded-lg p-2 border ${config.darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                   <SimpleLineChart data={trendData} color="#EF4444" />
                </div>
             </div>

             {/* 修改：固定列表高度，避免无限挤压 */}
             <div className="mb-4 flex flex-col overflow-hidden" style={{ height: '180px', flexShrink: 0 }}>
                <div className="flex justify-between items-center mb-2">
                  <h4 className={`text-xs font-medium uppercase tracking-wider flex items-center gap-1 ${textMuted}`}>
                    <Radio size={12} className="text-purple-500"/> 实时感知列表
                  </h4>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${config.rfidEnabled ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                    {config.rfidEnabled ? 'Active' : 'Offline'}
                  </span>
                </div>
                
                <div className={`flex-1 border rounded-lg overflow-y-auto p-2 scrollbar-thin ${config.darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                   {!isDetecting ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                         <Radio size={24} className="mb-1"/>
                         <span className="text-xs">系统待机中...</span>
                      </div>
                   ) : activeRfidItems.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                         <Scan size={24} className="mb-1 animate-pulse"/>
                         <span className="text-xs">正在扫描附近标签...</span>
                      </div>
                   ) : (
                      <div className="space-y-2">
                         {activeRfidItems.map((item, idx) => (
                           <div key={idx} className={`p-2 rounded border flex items-center gap-3 animate-fadeIn ${config.darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
                              {/* 模拟头像/图标 */}
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${item.avatarColor || 'bg-blue-500'}`}>
                                 {item.name[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <div className={`text-xs font-bold truncate ${textMain}`}>{item.name} <span className="text-[9px] text-gray-400 font-normal">| {item.plate}</span></div>
                                 <div className="text-[10px] text-purple-500 flex items-center gap-1">
                                    <CreditCard size={8} /> {item.company}
                                 </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                 <div className="flex gap-0.5 items-end h-3">
                                    {[1,2,3,4].map(bar => (
                                       <div key={bar} className={`w-1 bg-purple-500 rounded-sm ${bar < 3 ? 'opacity-100' : 'opacity-30'}`} style={{height: `${bar*25}%`}} />
                                    ))}
                                 </div>
                                 <span className="text-[9px] text-gray-400">-{Math.abs(item.rssi)}dBm</span>
                              </div>
                           </div>
                         ))}
                      </div>
                   )}
                </div>
             </div>
             
             {/* 修改：让日志占满剩余空间，并设置最小高度 */}
             <div className="flex-1 flex flex-col overflow-hidden min-h-[150px]">
                <div className="flex justify-between items-center mb-2">
                   <h4 className={`text-xs font-medium ${textMuted}`}>系统日志 (Fusion Log)</h4>
                   <div className="flex gap-2">
                      <button 
                        onClick={handleClearLogs} 
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 transition-colors" 
                        title="清空日志"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button 
                        onClick={handleExportLogs} 
                        className="p-1 hover:bg-gray-100 rounded text-blue-500 transition-colors" 
                        title="导出日志"
                      >
                        <Download size={14} />
                      </button>
                   </div>
                </div>
                <div className={`flex-1 overflow-auto border rounded-lg text-xs ${config.darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                   {logs.length === 0 ? (
                     <div className="flex items-center justify-center h-full text-gray-500">
                       暂无记录
                     </div>
                   ) : (
                     logs.map(log => (
                        <div key={log.id} className={`p-2 border-b flex justify-between ${config.darkMode ? 'border-gray-800 text-gray-400' : 'border-gray-100 text-gray-600'}`}>
                            <span>{log.time}</span>
                            <span className={log.type.includes('射频') ? 'text-purple-500 font-bold' : log.type.includes('违规') ? 'text-red-500' : log.type.includes('错误') ? 'text-orange-500' : 'text-blue-500'}>{log.message}</span>
                        </div>
                     ))
                   )}
                </div>
             </div>

           </div>
        </div>
      </main>
    </div>
  );
}