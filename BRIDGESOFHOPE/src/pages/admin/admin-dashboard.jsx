import React from 'react';
import { FileText, Thermometer, Clipboard, Activity } from "lucide-react";

const NurseDashboard = () => {
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Nurse Module: Weekly Reporting</h1>
        <p className="text-sm text-gray-500">Bridges of Hope Digital Platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Form Sections */}
        <div className="md:col-span-2 space-y-6">
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="flex items-center gap-2 font-semibold mb-4 text-blue-600">
              <Thermometer size={20} /> Vital Signs & BMI
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="Weight (kg)" className="p-2 border rounded" />
              <input type="text" placeholder="Height (cm)" className="p-2 border rounded" />
              <input type="text" placeholder="BP (mmHg)" className="p-2 border rounded" />
              <input type="text" placeholder="Temperature (°C)" className="p-2 border rounded" />
            </div>
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="flex items-center gap-2 font-semibold mb-4 text-blue-600">
              <Clipboard size={20} /> Interventions & Nursing Care
            </h2>
            <textarea placeholder="Describe nursing interventions..." className="w-full p-3 border rounded h-32"></textarea>
          </section>
        </div>

        {/* Right Column: Status/Summary */}
        <div className="space-y-6">
          <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
            <h3 className="font-bold mb-2">Report Status</h3>
            <p className="text-sm opacity-90 mb-4">You have 4 pending weekly reports for this shift.</p>
            <button className="w-full bg-white text-blue-600 py-2 rounded-lg font-bold">Submit Current Report</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NurseDashboard;