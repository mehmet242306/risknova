"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Locale = "tr" | "en" | "ar" | "ru" | "de" | "fr" | "es" | "zh" | "ja" | "hi";

type NestedMessages = { [key: string]: string | NestedMessages };

/* ------------------------------------------------------------------ */
/* Message dictionaries                                                */
/* ------------------------------------------------------------------ */

const messages: Record<Locale, NestedMessages> = {
  tr: {
    common: {
      login: "Giris Yap",
      register: "Hemen Basla",
      freeStart: "Ucretsiz Basla",
      platformLogin: "Platforma Giris Yap",
      profile: "Profil",
      settings: "Ayarlar",
      save: "Kaydet",
      cancel: "Iptal",
      delete: "Sil",
      edit: "Duzenle",
      close: "Kapat",
      search: "Ara",
      loading: "Yukleniyor...",
      noData: "Veri bulunamadi",
      error: "Hata olustu",
      success: "Basarili",
      download: "Indir",
      copy: "Kopyala",
      saved: "Kaydedildi",
    },
    nav: {
      dashboard: "Dashboard",
      companies: "Firmalar",
      riskAnalysis: "Risk Analizi",
      incidents: "Olaylar",
      scoreHistory: "Skor Gecmisi",
      planner: "Planlayici",
      timesheet: "Puantaj",
      solutionCenter: "Cozum Merkezi",
      reports: "Raporlar",
      settings: "Ayarlar",
      features: "Ozellikler",
      howItWorks: "Nasil Calisir",
    },
    landing: {
      badge: "YAPAY ZEKA DESTEKLI ISG PLATFORMU",
      heroTitle1: "ISG Risk Yonetimini",
      heroTitle2: "Sanata",
      heroTitle3: "Donusturun",
      heroDescription: "RiskNova; risk analizi, saha takibi, kayit, raporlama ve karar destegi sureclerini tek urun hissi icinde birlestirmek icin tasarlanmis AI destekli ISG platformudur.",
      statsUsers: "AKTIF KULLANICI",
      statsUptime: "UPTIME",
      statsAnalysis: "ANALIZ SURESI",
      statsScoring: "RISK PUANLAMA",
      featuresEyebrow: "OZELLIKLER",
      featuresTitle1: "Kapsamli",
      featuresTitle2: "Cozumler",
      featuresDescription: "ISG sureclerinizi uctan uca yoneten profesyonel araclar.",
      feat1Title: "AI destekli risk analizi",
      feat1Desc: "Manuel veya modul bazli risk girdilerini tek akista toplayan, sonuclari daha gorunur hale getiren urun temeli.",
      feat2Title: "Saha bulgulari ve aksiyon yonetimi",
      feat2Desc: "Denetim, bulgu, gorev ve takip alanlarini operasyon ekibinin okuyabilecegi duzen icinde bir araya getirir.",
      feat3Title: "Raporlama ve kayit altyapisi",
      feat3Desc: "Olusturulan sonuclarin gecmis, detay ve cikti sureclerine baglanabilecegi tutarli ekran omurgasi saglar.",
      feat4Title: "Risk modulu icin urun vitrini",
      feat4Desc: "Risk analizi ekrani, sonuc ekrani ve skor gecmisi gibi alanlar icin profesyonel ve guven veren zemin hazirlar.",
      feat5Title: "Mobil, tablet ve desktop uyumu",
      feat5Desc: "Tek kolon, iki kolon ve genis ekran yerlesimariyle farkli cihazlarda okunabilirligini korur.",
      feat6Title: "Kurumsal ve modern gorsel dil",
      feat6Desc: "Acik yuzeyler, kontrollu kontrast ve net CTA yapisiyla profesyonel SaaS hissi uretir.",
      howEyebrow: "NASIL CALISIR",
      howTitle1: "Dort Adimda",
      howTitle2: "Kontrol",
      howDescription: "Platformumuzu kullanmaya baslamak icin basit adimlar.",
      step1Title: "Guvenli Erisim",
      step1Desc: "Kurumunuza ozel hesabinizla platforma guvenli bir sekilde giris yapin.",
      step2Title: "Risk Verisinin Girilmesi",
      step2Desc: "Alan denetimleri, tehlike bildirimleri ve risk parametrelerini sisteme aktarin.",
      step3Title: "R-SKOR Uretimi",
      step3Desc: "AI destekli analiz motorumuz verilerinizi isleyerek risk skorlarini hesaplar.",
      step4Title: "Aksiyon ve Takip",
      step4Desc: "Sonuclara dayali aksiyon planlari olusturun, takip edin ve raporlayin.",
      whyEyebrow: "NEDEN RISKNOVA",
      whyTitle1: "Guven Veren",
      whyTitle2: "Premium",
      whyTitle3: "Deneyim",
      whyDescription: "Mavi guven hissini ve altin kalite vurgusunu tasiyan, acik yuzeyler ve yumusak kontrast ile profesyonel SaaS deneyimi olusturur.",
      whyBullet1: "Temiz, modern ve guven veren ISG gorunumu",
      whyBullet2: "Operasyon odakli, dikkat dagitmayan ekran kurgusu",
      whyBullet3: "Risk Intelligence modulune hazir tasarim sistemi",
      whyBullet4: "Multi-tenant organizasyon bazli guvenli yapi",
      whyBullet5: "AI destekli karar destek mekanizmasi",
      whyBullet6: "Kurumsal raporlama ve arsiv altyapisi",
      ctaEyebrow: "HAZIR CTA ALANI",
      ctaTitle: "Risk modulunu urun vitrini haline getirin",
      ctaDescription: "Profesyonel gorunum, guclu altyapi ve AI destegi ile ISG sureclerinizi tek platformda yonetin.",
      footerDescription: "AI destekli ISG karar destek platformu",
      footerProduct: "Urun",
      footerLegal: "Yasal",
      footerPrivacy: "Gizlilik Politikasi",
      footerTerms: "Kullanim Kosullari",
      footerContact: "Iletisim",
      footerRights: "Tum haklari saklidir.",
    },
    auth: {
      loginTitle: "Hesabina giris yap",
      loginDescription: "Risk analizi, saha takibi ve raporlama sureclerini tek platformda yonetmeye devam et.",
      loginEmail: "E-posta adresi",
      loginPassword: "Sifre",
      loginButton: "Giris Yap",
      loginLoading: "Giris yapiliyor...",
      loginForgot: "Sifremi unuttum",
      loginNoAccount: "Hesabin yok mu?",
      loginRegister: "Kayit ol",
      registerTitle: "Hesap olustur",
      registerDescription: "ISG sureclerinizi dijitallestin ve AI destekli karar verme mekanizmasindan faydalanin.",
      registerName: "Ad Soyad",
      registerEmail: "E-posta adresi",
      registerPassword: "Sifre",
      registerButton: "Kayit Ol",
      registerLoading: "Kayit olusturuluyor...",
      registerHasAccount: "Zaten hesabin var mi?",
      registerLogin: "Giris yap",
      forgotTitle: "Sifreni sifirla",
      forgotDescription: "E-posta adresini gir, sana sifre sifirlama baglantisi gonderelim.",
      forgotButton: "Sifirlama baglantisi gonder",
      forgotBack: "Girise don",
    },
    solutionCenter: {
      title: "Cozum Merkezi",
      description: "ISG ile ilgili sorularinizi sorun, mevzuat taramasi yapin, cozum onerileri alin. Tum yanitlar Turk mevzuati referanslari ile desteklenir.",
      inputPlaceholder: "ISG ile ilgili sorunuzu yazin...",
      queries: "sorgu",
      referenced: "mevzuat referansli",
      sources: "mevzuat kaynagi",
      save: "Kaydet",
      saved: "Kaydedildi",
      copy: "Kopyala",
      chat: "Sohbet",
      history: "Gecmis",
      documents: "Dokumanlarim",
    },
  },

  en: {
    common: {
      login: "Sign In",
      register: "Get Started",
      freeStart: "Start Free",
      platformLogin: "Sign In to Platform",
      profile: "Profile",
      settings: "Settings",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      search: "Search",
      loading: "Loading...",
      noData: "No data found",
      error: "An error occurred",
      success: "Success",
      download: "Download",
      copy: "Copy",
      saved: "Saved",
    },
    nav: {
      dashboard: "Dashboard",
      companies: "Companies",
      riskAnalysis: "Risk Analysis",
      incidents: "Incidents",
      scoreHistory: "Score History",
      planner: "Planner",
      timesheet: "Timesheet",
      solutionCenter: "Solution Center",
      reports: "Reports",
      settings: "Settings",
      features: "Features",
      howItWorks: "How It Works",
    },
    landing: {
      badge: "AI-POWERED OHS PLATFORM",
      heroTitle1: "Transform OHS Risk",
      heroTitle2: "Management",
      heroTitle3: "Into Art",
      heroDescription: "RiskNova is an AI-powered OHS platform designed to unify risk analysis, field tracking, recording, reporting and decision support processes into a single product experience.",
      statsUsers: "ACTIVE USERS",
      statsUptime: "UPTIME",
      statsAnalysis: "ANALYSIS TIME",
      statsScoring: "RISK SCORING",
      featuresEyebrow: "FEATURES",
      featuresTitle1: "Comprehensive",
      featuresTitle2: "Solutions",
      featuresDescription: "Professional tools that manage your OHS processes end-to-end.",
      feat1Title: "AI-powered risk analysis",
      feat1Desc: "A product foundation that collects manual or module-based risk inputs in a single flow and makes results more visible.",
      feat2Title: "Field findings & action management",
      feat2Desc: "Brings together audit, finding, task and tracking areas in an order that the operations team can read.",
      feat3Title: "Reporting & recording infrastructure",
      feat3Desc: "Provides a consistent screen backbone where generated results can be linked to history, detail and output processes.",
      feat4Title: "Product showcase for risk module",
      feat4Desc: "Prepares a professional and trust-inspiring foundation for areas such as risk analysis screen, results screen and score history.",
      feat5Title: "Mobile, tablet & desktop responsive",
      feat5Desc: "Maintains readability across different devices with single column, two column and wide screen layouts.",
      feat6Title: "Corporate & modern visual language",
      feat6Desc: "Creates a professional SaaS feel with clean surfaces, controlled contrast and clear CTA structure.",
      howEyebrow: "HOW IT WORKS",
      howTitle1: "Control in",
      howTitle2: "Four Steps",
      howDescription: "Simple steps to get started with our platform.",
      step1Title: "Secure Access",
      step1Desc: "Sign in securely to the platform with your organization-specific account.",
      step2Title: "Risk Data Entry",
      step2Desc: "Transfer field audits, hazard reports and risk parameters to the system.",
      step3Title: "R-SCORE Generation",
      step3Desc: "Our AI-powered analysis engine processes your data to calculate risk scores.",
      step4Title: "Action & Follow-up",
      step4Desc: "Create action plans based on results, track and report.",
      whyEyebrow: "WHY RISKNOVA",
      whyTitle1: "Trust-Inspiring",
      whyTitle2: "Premium",
      whyTitle3: "Experience",
      whyDescription: "Creates a professional SaaS experience with blue trust and gold quality emphasis, clean surfaces and soft contrast.",
      whyBullet1: "Clean, modern and trust-inspiring OHS appearance",
      whyBullet2: "Operation-focused, distraction-free screen layout",
      whyBullet3: "Design system ready for Risk Intelligence module",
      whyBullet4: "Multi-tenant organization-based secure structure",
      whyBullet5: "AI-powered decision support mechanism",
      whyBullet6: "Corporate reporting and archive infrastructure",
      ctaEyebrow: "READY CTA AREA",
      ctaTitle: "Turn your risk module into a product showcase",
      ctaDescription: "Manage your OHS processes on a single platform with professional appearance, powerful infrastructure and AI support.",
      footerDescription: "AI-powered OHS decision support platform",
      footerProduct: "Product",
      footerLegal: "Legal",
      footerPrivacy: "Privacy Policy",
      footerTerms: "Terms of Use",
      footerContact: "Contact",
      footerRights: "All rights reserved.",
    },
    auth: {
      loginTitle: "Sign in to your account",
      loginDescription: "Continue managing risk analysis, field tracking and reporting processes on a single platform.",
      loginEmail: "Email address",
      loginPassword: "Password",
      loginButton: "Sign In",
      loginLoading: "Signing in...",
      loginForgot: "Forgot password",
      loginNoAccount: "Don't have an account?",
      loginRegister: "Sign up",
      registerTitle: "Create an account",
      registerDescription: "Digitize your OHS processes and benefit from AI-powered decision-making mechanisms.",
      registerName: "Full Name",
      registerEmail: "Email address",
      registerPassword: "Password",
      registerButton: "Sign Up",
      registerLoading: "Creating account...",
      registerHasAccount: "Already have an account?",
      registerLogin: "Sign in",
      forgotTitle: "Reset your password",
      forgotDescription: "Enter your email address and we'll send you a password reset link.",
      forgotButton: "Send reset link",
      forgotBack: "Back to sign in",
    },
    solutionCenter: {
      title: "Solution Center",
      description: "Ask your OHS questions, search legislation, get solution suggestions. All answers are supported with references.",
      inputPlaceholder: "Type your OHS question...",
      queries: "queries",
      referenced: "with references",
      sources: "legislation sources",
      save: "Save",
      saved: "Saved",
      copy: "Copy",
      chat: "Chat",
      history: "History",
      documents: "My Documents",
    },
  },

  ar: {
    common: {
      login: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
      register: "\u0627\u0628\u062F\u0623 \u0627\u0644\u0622\u0646",
      freeStart: "\u0627\u0628\u062F\u0623 \u0645\u062C\u0627\u0646\u0627\u064B",
      platformLogin: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0645\u0646\u0635\u0629",
      profile: "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A",
      settings: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A",
      save: "\u062D\u0641\u0638",
      cancel: "\u0625\u0644\u063A\u0627\u0621",
      delete: "\u062D\u0630\u0641",
      edit: "\u062A\u0639\u062F\u064A\u0644",
      close: "\u0625\u063A\u0644\u0627\u0642",
      search: "\u0628\u062D\u062B",
      loading: "\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644...",
      noData: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A",
      error: "\u062D\u062F\u062B \u062E\u0637\u0623",
      success: "\u0646\u062C\u0627\u062D",
      download: "\u062A\u062D\u0645\u064A\u0644",
      copy: "\u0646\u0633\u062E",
      saved: "\u062A\u0645 \u0627\u0644\u062D\u0641\u0638",
    },
    nav: {
      dashboard: "\u0644\u0648\u062D\u0629 \u0627\u0644\u0642\u064A\u0627\u062F\u0629",
      companies: "\u0627\u0644\u0634\u0631\u0643\u0627\u062A",
      riskAnalysis: "\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u062E\u0627\u0637\u0631",
      incidents: "\u0627\u0644\u062D\u0648\u0627\u062F\u062B",
      scoreHistory: "\u0633\u062C\u0644 \u0627\u0644\u0646\u0642\u0627\u0637",
      planner: "\u0627\u0644\u0645\u062E\u0637\u0637",
      timesheet: "\u0627\u0644\u062D\u0636\u0648\u0631",
      solutionCenter: "\u0645\u0631\u0643\u0632 \u0627\u0644\u062D\u0644\u0648\u0644",
      reports: "\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631",
      settings: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A",
      features: "\u0627\u0644\u0645\u0645\u064A\u0632\u0627\u062A",
      howItWorks: "\u0643\u064A\u0641 \u064A\u0639\u0645\u0644",
    },
    landing: {
      badge: "\u0645\u0646\u0635\u0629 \u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0647\u0646\u064A\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A",
      heroTitle1: "\u062D\u0648\u0651\u0644 \u0625\u062F\u0627\u0631\u0629 \u0645\u062E\u0627\u0637\u0631",
      heroTitle2: "\u0627\u0644\u0633\u0644\u0627\u0645\u0629",
      heroTitle3: "\u0625\u0644\u0649 \u0641\u0646",
      heroDescription: "\u0631\u064A\u0633\u0643 \u0646\u0648\u0641\u0627 \u0645\u0646\u0635\u0629 \u0633\u0644\u0627\u0645\u0629 \u0645\u0647\u0646\u064A\u0629 \u0645\u062F\u0639\u0648\u0645\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A",
      featuresEyebrow: "\u0627\u0644\u0645\u0645\u064A\u0632\u0627\u062A",
      howEyebrow: "\u0643\u064A\u0641 \u064A\u0639\u0645\u0644",
      whyEyebrow: "\u0644\u0645\u0627\u0630\u0627 \u0631\u064A\u0633\u0643 \u0646\u0648\u0641\u0627",
    },
    auth: {
      loginTitle: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
      loginEmail: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A",
      loginPassword: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631",
      loginButton: "\u062F\u062E\u0648\u0644",
    },
    solutionCenter: {
      title: "\u0645\u0631\u0643\u0632 \u0627\u0644\u062D\u0644\u0648\u0644",
      description: "\u0627\u0637\u0631\u062D \u0623\u0633\u0626\u0644\u062A\u0643 \u062D\u0648\u0644 \u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0647\u0646\u064A\u0629",
    },
  },

  ru: {
    common: { login: "\u0412\u043E\u0439\u0442\u0438", register: "\u041D\u0430\u0447\u0430\u0442\u044C", save: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C", cancel: "\u041E\u0442\u043C\u0435\u043D\u0430", delete: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", search: "\u041F\u043E\u0438\u0441\u043A", loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...", download: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C", copy: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C" },
    nav: { dashboard: "\u041F\u0430\u043D\u0435\u043B\u044C", companies: "\u041A\u043E\u043C\u043F\u0430\u043D\u0438\u0438", riskAnalysis: "\u0410\u043D\u0430\u043B\u0438\u0437 \u0440\u0438\u0441\u043A\u043E\u0432", incidents: "\u0418\u043D\u0446\u0438\u0434\u0435\u043D\u0442\u044B", solutionCenter: "\u0426\u0435\u043D\u0442\u0440 \u0440\u0435\u0448\u0435\u043D\u0438\u0439", reports: "\u041E\u0442\u0447\u0435\u0442\u044B", settings: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438" },
    landing: { badge: "\u041F\u041B\u0410\u0422\u0424\u041E\u0420\u041C\u0410 \u041E\u0422 \u0421 \u0418\u0418", heroTitle1: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0440\u0438\u0441\u043A\u0430\u043C\u0438", heroTitle2: "\u041E\u0422", heroTitle3: "\u043A\u0430\u043A \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u043E" },
    auth: { loginTitle: "\u0412\u043E\u0439\u0442\u0438 \u0432 \u0430\u043A\u043A\u0430\u0443\u043D\u0442", loginEmail: "\u042D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u0430\u044F \u043F\u043E\u0447\u0442\u0430", loginPassword: "\u041F\u0430\u0440\u043E\u043B\u044C", loginButton: "\u0412\u043E\u0439\u0442\u0438" },
    solutionCenter: { title: "\u0426\u0435\u043D\u0442\u0440 \u0440\u0435\u0448\u0435\u043D\u0438\u0439" },
  },

  de: {
    common: { login: "Anmelden", register: "Jetzt starten", save: "Speichern", cancel: "Abbrechen", delete: "Loschen", search: "Suchen", loading: "Laden...", download: "Herunterladen", copy: "Kopieren" },
    nav: { dashboard: "Dashboard", companies: "Unternehmen", riskAnalysis: "Risikoanalyse", incidents: "Vorfalle", solutionCenter: "Losungszentrum", reports: "Berichte", settings: "Einstellungen" },
    landing: { badge: "KI-GESTUTZTE ARBEITSSCHUTZ-PLATTFORM", heroTitle1: "Risikomanagement", heroTitle2: "im Arbeitsschutz", heroTitle3: "zur Kunst machen" },
    auth: { loginTitle: "Anmelden", loginEmail: "E-Mail-Adresse", loginPassword: "Passwort", loginButton: "Anmelden" },
    solutionCenter: { title: "Losungszentrum" },
  },

  fr: {
    common: { login: "Se connecter", register: "Commencer", save: "Enregistrer", cancel: "Annuler", delete: "Supprimer", search: "Rechercher", loading: "Chargement...", download: "Telecharger", copy: "Copier" },
    nav: { dashboard: "Tableau de bord", companies: "Entreprises", riskAnalysis: "Analyse des risques", incidents: "Incidents", solutionCenter: "Centre de solutions", reports: "Rapports", settings: "Parametres" },
    landing: { badge: "PLATEFORME SST ALIMENTEE PAR L'IA", heroTitle1: "Transformez la gestion", heroTitle2: "des risques SST", heroTitle3: "en art" },
    auth: { loginTitle: "Se connecter", loginEmail: "Adresse e-mail", loginPassword: "Mot de passe", loginButton: "Se connecter" },
    solutionCenter: { title: "Centre de solutions" },
  },

  es: {
    common: { login: "Iniciar sesion", register: "Comenzar", save: "Guardar", cancel: "Cancelar", delete: "Eliminar", search: "Buscar", loading: "Cargando...", download: "Descargar", copy: "Copiar" },
    nav: { dashboard: "Panel", companies: "Empresas", riskAnalysis: "Analisis de riesgos", incidents: "Incidentes", solutionCenter: "Centro de soluciones", reports: "Informes", settings: "Configuracion" },
    landing: { badge: "PLATAFORMA SST IMPULSADA POR IA", heroTitle1: "Transforme la gestion", heroTitle2: "de riesgos SST", heroTitle3: "en arte" },
    auth: { loginTitle: "Iniciar sesion", loginEmail: "Correo electronico", loginPassword: "Contrasena", loginButton: "Iniciar sesion" },
    solutionCenter: { title: "Centro de soluciones" },
  },

  zh: {
    common: { login: "\u767B\u5F55", register: "\u5F00\u59CB\u4F7F\u7528", save: "\u4FDD\u5B58", cancel: "\u53D6\u6D88", delete: "\u5220\u9664", search: "\u641C\u7D22", loading: "\u52A0\u8F7D\u4E2D...", download: "\u4E0B\u8F7D", copy: "\u590D\u5236" },
    nav: { dashboard: "\u4EEA\u8868\u677F", companies: "\u516C\u53F8", riskAnalysis: "\u98CE\u9669\u5206\u6790", incidents: "\u4E8B\u6545", solutionCenter: "\u89E3\u51B3\u65B9\u6848\u4E2D\u5FC3", reports: "\u62A5\u544A", settings: "\u8BBE\u7F6E" },
    landing: { badge: "\u4EBA\u5DE5\u667A\u80FD\u9A71\u52A8\u7684\u804C\u4E1A\u5065\u5EB7\u5B89\u5168\u5E73\u53F0", heroTitle1: "\u5C06\u804C\u4E1A\u5065\u5EB7\u5B89\u5168", heroTitle2: "\u98CE\u9669\u7BA1\u7406", heroTitle3: "\u5316\u4E3A\u827A\u672F" },
    auth: { loginTitle: "\u767B\u5F55\u60A8\u7684\u8D26\u6237", loginEmail: "\u7535\u5B50\u90AE\u4EF6", loginPassword: "\u5BC6\u7801", loginButton: "\u767B\u5F55" },
    solutionCenter: { title: "\u89E3\u51B3\u65B9\u6848\u4E2D\u5FC3" },
  },

  ja: {
    common: { login: "\u30ED\u30B0\u30A4\u30F3", register: "\u59CB\u3081\u308B", save: "\u4FDD\u5B58", cancel: "\u30AD\u30E3\u30F3\u30BB\u30EB", delete: "\u524A\u9664", search: "\u691C\u7D22", loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D...", download: "\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9", copy: "\u30B3\u30D4\u30FC" },
    nav: { dashboard: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9", companies: "\u4F1A\u793E", riskAnalysis: "\u30EA\u30B9\u30AF\u5206\u6790", incidents: "\u30A4\u30F3\u30B7\u30C7\u30F3\u30C8", solutionCenter: "\u30BD\u30EA\u30E5\u30FC\u30B7\u30E7\u30F3\u30BB\u30F3\u30BF\u30FC", reports: "\u30EC\u30DD\u30FC\u30C8", settings: "\u8A2D\u5B9A" },
    landing: { badge: "AI\u642D\u8F09\u52B4\u50CD\u5B89\u5168\u885B\u751F\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0", heroTitle1: "\u52B4\u50CD\u5B89\u5168\u885B\u751F", heroTitle2: "\u30EA\u30B9\u30AF\u7BA1\u7406\u3092", heroTitle3: "\u82B8\u8853\u306B" },
    auth: { loginTitle: "\u30ED\u30B0\u30A4\u30F3", loginEmail: "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9", loginPassword: "\u30D1\u30B9\u30EF\u30FC\u30C9", loginButton: "\u30ED\u30B0\u30A4\u30F3" },
    solutionCenter: { title: "\u30BD\u30EA\u30E5\u30FC\u30B7\u30E7\u30F3\u30BB\u30F3\u30BF\u30FC" },
  },

  hi: {
    common: { login: "\u0932\u0949\u0917 \u0907\u0928", register: "\u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902", save: "\u0938\u0947\u0935 \u0915\u0930\u0947\u0902", cancel: "\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902", delete: "\u0939\u091F\u093E\u090F\u0902", search: "\u0916\u094B\u091C\u0947\u0902", loading: "\u0932\u094B\u0921 \u0939\u094B \u0930\u0939\u093E \u0939\u0948...", download: "\u0921\u093E\u0909\u0928\u0932\u094B\u0921", copy: "\u0915\u0949\u092A\u0940" },
    nav: { dashboard: "\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921", companies: "\u0915\u0902\u092A\u0928\u0940", riskAnalysis: "\u091C\u094B\u0916\u093F\u092E \u0935\u093F\u0936\u094D\u0932\u0947\u0937\u0923", incidents: "\u0918\u091F\u0928\u093E\u090F\u0902", solutionCenter: "\u0938\u092E\u093E\u0927\u093E\u0928 \u0915\u0947\u0902\u0926\u094D\u0930", reports: "\u0930\u093F\u092A\u094B\u0930\u094D\u091F", settings: "\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938" },
    landing: { badge: "AI \u0938\u0902\u091A\u093E\u0932\u093F\u0924 \u0935\u094D\u092F\u093E\u0935\u0938\u093E\u092F\u093F\u0915 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0914\u0930 \u0938\u0941\u0930\u0915\u094D\u0937\u093E \u092A\u094D\u0932\u0947\u091F\u092B\u0949\u0930\u094D\u092E", heroTitle1: "\u0935\u094D\u092F\u093E\u0935\u0938\u093E\u092F\u093F\u0915 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F", heroTitle2: "\u091C\u094B\u0916\u093F\u092E \u092A\u094D\u0930\u092C\u0902\u0927\u0928", heroTitle3: "\u0915\u094B \u0915\u0932\u093E \u092E\u0947\u0902 \u092C\u0926\u0932\u0947\u0902" },
    auth: { loginTitle: "\u0932\u0949\u0917 \u0907\u0928 \u0915\u0930\u0947\u0902", loginEmail: "\u0908\u092E\u0947\u0932", loginPassword: "\u092A\u093E\u0938\u0935\u0930\u094D\u0921", loginButton: "\u0932\u0949\u0917 \u0907\u0928" },
    solutionCenter: { title: "\u0938\u092E\u093E\u0927\u093E\u0928 \u0915\u0947\u0902\u0926\u094D\u0930" },
  },
};

/* ------------------------------------------------------------------ */
/* Helper: resolve nested key "landing.heroTitle1"                     */
/* ------------------------------------------------------------------ */

function resolve(obj: NestedMessages, path: string): string {
  const parts = path.split(".");
  let current: string | NestedMessages = obj;
  for (const part of parts) {
    if (typeof current === "string") return path;
    current = current[part];
    if (current === undefined) return path;
  }
  return typeof current === "string" ? current : path;
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "tr",
  setLocale: () => {},
  t: (key) => key,
});

const STORAGE_KEY = "risknova-locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("tr");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && messages[saved]) {
      setLocaleState(saved);
    }
  }, []);

  // Listen for storage changes (cross-tab sync)
  useEffect(() => {
    function onStorage() {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && messages[saved]) {
        setLocaleState(saved);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function setLocale(newLocale: Locale) {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }

  function t(key: string): string {
    // Try current locale first, fallback to Turkish, then key
    const result = resolve(messages[locale] || {}, key);
    if (result !== key) return result;
    // Fallback to Turkish
    const fallback = resolve(messages.tr, key);
    return fallback !== key ? fallback : key;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useTranslation() {
  const { t, locale } = useContext(I18nContext);
  return { t, locale };
}
