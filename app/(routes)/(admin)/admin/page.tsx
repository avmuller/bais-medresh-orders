"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Package,
  Building2,
  FolderTree,
  ShoppingCart,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const managementSections = [
  {
    title: "ניהול מוצרים",
    description: "הוספה, עריכה וניהול מלאי המוצרים.",
    icon: Package,
    link: "/admin/products",
    color: "from-blue-600 to-cyan-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    title: "ניהול ספקים",
    description: "עדכון ותחזוקת פרטי ספקים.",
    icon: Building2,
    link: "/admin/suppliers",
    color: "from-emerald-600 to-teal-600",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-600",
  },
  {
    title: "ניהול קטגוריות",
    description: "סידור מוצרים לפי קטגוריות.",
    icon: FolderTree,
    link: "/admin/categories",
    color: "from-purple-600 to-violet-600",
    bgColor: "bg-purple-50",
    textColor: "text-purple-600",
  },
  {
    title: "ניהול הזמנות",
    description: "צפייה וניהול כל ההזמנות במערכת.",
    icon: ShoppingCart,
    link: "/admin/orders",
    color: "from-amber-600 to-orange-600",
    bgColor: "bg-amber-50",
    textColor: "text-amber-600",
  },
  {
    title: "ניהול משתמשים",
    description: "ניהול הרשאות ופרטי משתמשים.",
    icon: Users,
    link: "/admin/users",
    color: "from-pink-600 to-rose-600",
    bgColor: "bg-pink-50",
    textColor: "text-pink-600",
  },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            לוח ניהול
          </h1>
          <p className="text-lg text-gray-600 mt-4">
            שליטה ובקרה על הפעילות העסקית שלך
          </p>
        </motion.div>

        {/* Management Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {managementSections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`${
                index === managementSections.length - 1 ? "md:col-span-2" : ""
              }`}
            >
              <Link href={section.link} className="h-full block">
                <Card className="group bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative h-full">
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${section.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                  />
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 ${section.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                      >
                        <section.icon
                          className={`w-6 h-6 ${section.textColor}`}
                        />
                      </div>
                      <CardTitle className="text-xl font-bold text-gray-800 group-hover:text-gray-900 transition-colors">
                        {section.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-600 leading-relaxed mb-6">
                      {section.description}
                    </p>
                    <div className="flex items-center text-sm font-semibold text-gray-400 group-hover:text-gray-600 transition-colors duration-300">
                      <span className={`${section.textColor}`}>
                        מעבר לניהול
                      </span>
                      <div className="w-2 h-2 ml-2 bg-gray-300 rounded-full group-hover:translate-x-1 group-hover:bg-blue-500 transition-all duration-300" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
