'use client';

import { KPIData } from '@/app/actions/kpi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';

interface OnboardingChartsProps {
  data: KPIData;
}

export function OnboardingCharts({ data }: OnboardingChartsProps) {
  const trendData = data.trends.labels.map((label, index) => ({
    name: label,
    onboarded: data.trends.onboarded[index],
    rejected: data.trends.rejected[index],
  }));

  const regionalData = data.distribution.regional.slice(0, 5);
  const genderData = data.distribution.gender;
  const ageData = data.distribution.age;
  const maritalData = data.distribution.maritalStatus;
  const townCityData = data.distribution.townCity.slice(0, 8);
  const subcityData = data.distribution.subcity.slice(0, 8);

  const COLORS = ['#935724', '#f6bb14', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      {/* 1. Primary Trend Chart */}
      <Card className="col-span-full lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Onboarding Performance Trends</CardTitle>
          <CardDescription className="text-xs">Successful syncs vs rejections over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorOnboarded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRejected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area 
                  type="monotone" 
                  dataKey="onboarded" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorOnboarded)" 
                  name="Successful Syncs" 
                />
                <Area 
                  type="monotone" 
                  dataKey="rejected" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorRejected)" 
                  name="Rejections" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 2. Age Distribution */}
      <Card className="col-span-full lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Age Distribution</CardTitle>
          <CardDescription className="text-xs">Customer age groups based on DOB</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(147, 87, 36, 0.05)' }}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#935724" 
                  radius={[4, 4, 0, 0]} 
                  name="Customers" 
                  barSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 3. Gender Demographics */}
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Gender</CardTitle>
          <CardDescription className="text-xs">Onboarding split by gender</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="name"
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 4. Marital Status */}
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Marital Status</CardTitle>
          <CardDescription className="text-xs">Customer social distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={maritalData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="name"
                >
                  {maritalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 5. Processing Latency */}
      <Card className="col-span-full lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Processing Latency</CardTitle>
          <CardDescription className="text-xs">Average time per stage (Hours)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Verification', time: data.processingTimeByStage.verification },
                { name: 'Approval', time: data.processingTimeByStage.approval },
                { name: 'T24 Sync', time: data.processingTimeByStage.sync },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(147, 87, 36, 0.05)' }}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar 
                  dataKey="time" 
                  fill="#f6bb14" 
                  radius={[4, 4, 0, 0]} 
                  name="Hours" 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 6. Regional Distribution */}
      <Card className="col-span-full lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Top 5 Regions</CardTitle>
          <CardDescription className="text-xs">Submission volume by region</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#935724" 
                  radius={[0, 4, 4, 0]} 
                  name="Requests" 
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 7. Town/City Distribution */}
      <Card className="col-span-full lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Top Cities / Towns</CardTitle>
          <CardDescription className="text-xs">Geographic split of onboarded customers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={townCityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(147, 87, 36, 0.05)' }}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#f6bb14" 
                  radius={[4, 4, 0, 0]} 
                  name="Customers" 
                  barSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 8. Sub-city Distribution */}
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Sub-city Distribution</CardTitle>
          <CardDescription className="text-xs">Detailed urban geographic breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subcityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(147, 87, 36, 0.05)' }}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#935724" 
                  radius={[4, 4, 0, 0]} 
                  name="Customers" 
                  barSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
