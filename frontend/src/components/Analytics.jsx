import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6'];

export const Analytics = ({ transactions }) => {
  const data = useMemo(() => {
    if (!transactions || transactions.length === 0) return { pieData: [], barData: [] };

    // Group expenses by category
    const expenseMap = {};
    const incomeMap = {};

    transactions.forEach(txn => {
      const cat = txn.proposedCategory || "Uncategorized";
      if (txn.type.toLowerCase() === 'debit' || txn.type.toLowerCase() === 'expense') {
        expenseMap[cat] = (expenseMap[cat] || 0) + txn.amount;
      } else {
        incomeMap[cat] = (incomeMap[cat] || 0) + txn.amount;
      }
    });

    const pieData = Object.keys(expenseMap).map(key => ({
      name: key,
      value: expenseMap[key]
    })).filter(d => d.value > 0);

    const barData = [
      { name: 'Income', amount: Object.values(incomeMap).reduce((a, b) => a + b, 0) },
      { name: 'Expense', amount: Object.values(expenseMap).reduce((a, b) => a + b, 0) }
    ];

    return { pieData, barData };
  }, [transactions]);

  if (data.pieData.length === 0 && data.barData[0].amount === 0) return null;

  return (
    <div className="analytics-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2rem', background: '#1e293b', padding: '1.5rem', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      <div style={{ width: '100%', height: 250 }}>
        <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#f8fafc', fontSize: '1.1rem' }}>Expense Breakdown</h3>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `₹${value}`} contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ width: '100%', height: 250 }}>
        <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#f8fafc', fontSize: '1.1rem' }}>Income vs Expense</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.barData}>
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip formatter={(value) => `₹${value}`} contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
            <Bar dataKey="amount" fill="#10B981" radius={[4, 4, 0, 0]}>
              {data.barData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.name === 'Income' ? '#10B981' : '#EF4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
