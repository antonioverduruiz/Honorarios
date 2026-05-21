import { useState, useEffect, useRef } from "react";

const fmt = (n) =>
  !n && n !== 0 ? "—" : Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Calculations ─────────────────────────────────────────────────────────────
function calcCosteHora(c) {
  const bi = (imp, pag) => (parseFloat(imp) || 0) * (parseFloat(pag) || 0);
  const total =
    bi(c.reta, c.retaP) + bi(c.premaat, c.premaatP) +
    bi(c.seguroRC, c.seguroRCP) + bi(c.cuotas, c.cuotasP) +
    (parseFloat(c.impPct) || 0) / 100 * (parseFloat(c.impIngresos) || 0) +
    bi(c.imagen, c.imagenP) + bi(c.office, c.officeP) +
    bi(c.icloud, c.icloudP) + bi(c.holded, c.holdedP) +
    bi(c.publi, c.publiP) + bi(c.otrasApps, c.otrasAppsP) +
    bi(c.amortLocal, c.amortLocalP) + bi(c.arrendLocal, c.arrendLocalP) +
    bi(c.telefonia, c.telefoniaP) + bi(c.suministros, c.suministrosP) +
    bi(c.impLocal, c.impLocalP) + bi(c.coche, c.cocheP) +
    bi(c.amortInf, c.amortInfP) + bi(c.amortOtros, c.amortOtrosP) +
    bi(c.otrasAmort, c.otrasAmortP) + bi(c.consumibles, c.consumiblesP) +
    bi(c.papeleria, c.papeleriaP) +
    bi(c.salario, c.salarioP);
  const hEf = (parseFloat(c.hEfDia) || 0) * (parseFloat(c.diasEf) || 0);
  return { total, hEf, costeHora: hEf > 0 ? total / hEf : 0 };
}

function calcCosteKm(k) {
  const v = (x) => parseFloat(x) || 0;
  const km = v(k.kmTotales) || 1;
  const anios = v(k.anios) || 1;
  const mant =
    (km / (v(k.kmNeum) || 1)) * v(k.costeNeum) +
    (km / (v(k.kmAceite) || 1)) * v(k.costeAceite) +
    v(k.otrasRev) * anios + v(k.reparac) * anios +
    v(k.seguro) * anios + v(k.impuestos) * anios +
    v(k.amortGaraje) * anios + v(k.arrendGaraje) * 12 * anios;
  const totalVeh = v(k.compra) + mant;
  const costePorKm = totalVeh / km;
  const costeCombKm = (km / 100) * v(k.consumo) * v(k.precioComb) / km;
  const prop = v(k.pctNoEfectivos);
  const costeKm = prop < 100 ? (costePorKm + costeCombKm) / (1 - prop / 100) : costePorKm + costeCombKm;
  return { totalVeh, costePorKm, costeCombKm, costeKm };
}

function calcHonorarios(obra, fO, fOf, vis, otros, ch, ck) {
  const dist = parseFloat(obra.distancia) || 0;
  const vel = parseFloat(obra.velocidad) || 110;
  const tDesp = vel > 0 ? dist / vel : 0;
  const filaObra = fO.map((f) => {
    const nv = parseFloat(f.visitas) || 0;
    const h = parseFloat(f.tiempo) || 0;
    const coef = parseFloat(f.coef) || 1;
    const prof = nv * h * ch;
    const desp = nv * dist * 2 * ck * coef + nv * tDesp * 2 * ch * coef;
    return { ...f, total: prof + desp };
  });
  const filaOf = fOf.map((f) => ({ ...f, total: (parseFloat(f.dias) || 0) * (parseFloat(f.tiempo) || 0) * ch }));
  const tObra = filaObra.reduce((a, r) => a + r.total, 0);
  const tOf = filaOf.reduce((a, r) => a + r.total, 0);
  const tVis = vis.reduce((a, v2) => a + (parseFloat(v2.uds) || 0) * (parseFloat(v2.coste) || 0), 0);
  const tOtros = otros.reduce((a, g) => a + (parseFloat(g.uds) || 0) * (parseFloat(g.precio) || 0), 0);
  return { filaObra, filaOf, tObra, tOf, tVis, tOtros, total: tObra + tOf + tVis + tOtros };
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0c1018", surf: "#131820", border: "#1c2333",
  text: "#dde3f0", muted: "#5a6880", accent: "#4f7eff",
  gBg: "#0a1f0c", gBorder: "#245530", gText: "#5ec96a",
  yBg: "#1e1600", yBorder: "#5a4200", yText: "#d4a820",
  mono: "'DM Mono', monospace", sans: "'DM Sans', sans-serif",
};

// ─── Wizard steps ─────────────────────────────────────────────────────────────
const CH_STEPS = [
  { type: "section", label: "Previsión social & seguros" },
  { key: "reta", keyP: "retaP", label: "RETA — Seguridad Social", hint: "Solo el coste mínimo legal mensual", suffix: "€", defaultP: "12", optional: false },
  { key: "premaat", keyP: "premaatP", label: "PREMAAT", hint: "Mutualidad alternativa, si la tienes", suffix: "€", defaultP: "12", optional: true },
  { key: "seguroRC", keyP: "seguroRCP", label: "Seguro de Responsabilidad Civil", suffix: "€", defaultP: "1", optional: false },
  { key: "cuotas", keyP: "cuotasP", label: "Cuotas colegiales", suffix: "€", defaultP: "12", optional: false },
  { type: "section", label: "Fiscalidad" },
  { key: "impPct", label: "% de impuestos estimados sobre ingresos brutos", hint: "Tu estimación de IRPF sobre el bruto anual", suffix: "%", optional: false, single: true },
  { key: "impIngresos", label: "Ingresos brutos previstos este año", suffix: "€", optional: false, single: true },
  { type: "section", label: "Software & imagen corporativa" },
  { key: "imagen", keyP: "imagenP", label: "Imagen corporativa / dominio web", suffix: "€", defaultP: "12", optional: true },
  { key: "office", keyP: "officeP", label: "Office 365 / Microsoft 365", suffix: "€", defaultP: "12", optional: true },
  { key: "icloud", keyP: "icloudP", label: "iCloud", suffix: "€", defaultP: "12", optional: true },
  { key: "holded", keyP: "holdedP", label: "Holded (facturación)", suffix: "€", defaultP: "12", optional: true },
  { key: "publi", keyP: "publiP", label: "Publicidad online", suffix: "€", defaultP: "12", optional: true },
  { key: "otrasApps", keyP: "otrasAppsP", label: "Otras apps y suscripciones", suffix: "€", defaultP: "12", optional: true },
  { type: "section", label: "Local & suministros" },
  { key: "amortLocal", keyP: "amortLocalP", label: "Amortización del local", suffix: "€", defaultP: "12", optional: true },
  { key: "arrendLocal", keyP: "arrendLocalP", label: "Arrendamiento del local", suffix: "€", defaultP: "12", optional: true },
  { key: "telefonia", keyP: "telefoniaP", label: "Telefonía e internet", suffix: "€", defaultP: "12", optional: false },
  { key: "suministros", keyP: "suministrosP", label: "Suministros (agua, electricidad…)", suffix: "€", defaultP: "12", optional: true },
  { key: "impLocal", keyP: "impLocalP", label: "Impuestos sobre el local", suffix: "€", defaultP: "1", optional: true },
  { key: "coche", keyP: "cocheP", label: "Coche — gastos generales (no desplazamientos)", hint: "Solo la parte de gastos fijos del coche, no los km de obra", suffix: "€", defaultP: "12", optional: true },
  { type: "section", label: "Equipos & consumibles" },
  { key: "amortInf", keyP: "amortInfP", label: "Amortización equipos informáticos", suffix: "€", defaultP: "12", optional: true },
  { key: "amortOtros", keyP: "amortOtrosP", label: "Amortización otros equipos profesionales", suffix: "€", defaultP: "12", optional: true },
  { key: "otrasAmort", keyP: "otrasAmortP", label: "Otras amortizaciones de material", suffix: "€", defaultP: "12", optional: true },
  { key: "consumibles", keyP: "consumiblesP", label: "Consumibles (cartuchos, material…)", suffix: "€", defaultP: "12", optional: true },
  { key: "papeleria", keyP: "papeleriaP", label: "Papelería e imprenta", suffix: "€", defaultP: "12", optional: true },
  { type: "section", label: "Salario" },
  { key: "salario", keyP: "salarioP", label: "Salario neto mensual que quieres percibir", suffix: "€", defaultP: "12", optional: false },
  { type: "section", label: "Horas de trabajo" },
  { key: "hEfDia", label: "Horas efectivas por día (imputables a encargos)", hint: "Recomendado entre 5 y 6 horas al día", suffix: "h/día", optional: false, single: true },
  { key: "diasEf", label: "Días hábiles al año (horas efectivas)", hint: "Recomendado entre 220 y 250 días", suffix: "días", optional: false, single: true },
  { key: "hRealDia", label: "Horas reales que trabajas al día", hint: "Incluyendo gestiones, formación y organización", suffix: "h/día", optional: true, single: true },
  { key: "diasReales", label: "Días hábiles reales al año", suffix: "días", optional: true, single: true },
];

const CK_STEPS = [
  {
    type: "message",
    title: "Ahora vamos a calcular el Coste del Km",
    body: "Para saber cuánto te cuesta cada kilómetro recorrido por motivos profesionales, necesitamos conocer los datos de tu vehículo: precio de compra, mantenimiento, seguro, combustible y otros gastos asociados.\n\nEstos datos, junto con el Coste/Hora que acabas de introducir, serán la base para calcular con precisión los honorarios de cualquier encargo.",
    accent: C.yText,
    icon: "🚗",
  },
  { type: "section", label: "Datos del vehículo" },
  { key: "compra", label: "Precio de compra del vehículo", suffix: "€", optional: false },
  { key: "kmTotales", label: "Kilómetros totales previstos durante su vida útil", suffix: "km", optional: false },
  { key: "anios", label: "Años de vida útil previstos", suffix: "años", optional: false },
  { type: "section", label: "Mantenimiento" },
  { key: "kmNeum", label: "Cada cuántos km cambias los neumáticos", suffix: "km", optional: false },
  { key: "costeNeum", label: "Coste de un juego de neumáticos", suffix: "€", optional: false },
  { key: "kmAceite", label: "Cada cuántos km haces el cambio de aceite", suffix: "km", optional: false },
  { key: "costeAceite", label: "Coste de cada cambio de aceite", suffix: "€", optional: false },
  { key: "otrasRev", label: "Otras revisiones y mantenimientos (por año)", hint: "ITV, lunas, accesorios, equipos…", suffix: "€/año", optional: true },
  { key: "reparac", label: "Estimación de reparaciones (por año)", suffix: "€/año", optional: true },
  { type: "section", label: "Seguro, impuestos & garaje" },
  { key: "seguro", label: "Seguro del automóvil", suffix: "€/año", optional: false },
  { key: "impuestos", label: "Impuestos sobre el vehículo (IVTM)", suffix: "€/año", optional: false },
  { key: "amortGaraje", label: "Amortización del garaje", suffix: "€/año", optional: true },
  { key: "arrendGaraje", label: "Arrendamiento del garaje", suffix: "€/mes", optional: true },
  { type: "section", label: "Combustible" },
  { key: "consumo", label: "Consumo medio cada 100 km", suffix: "litros", optional: false },
  { key: "precioComb", label: "Precio estimado del combustible", suffix: "€/litro", optional: false },
  { type: "section", label: "Ajuste" },
  { key: "pctNoEfectivos", label: "% de km profesionales no imputables a ningún encargo", hint: "Entre el 5% y el 20% es un rango razonable", suffix: "%", optional: false },
];

// ─── Empty state factories ────────────────────────────────────────────────────
const mkCH = () => ({ reta: "", retaP: "12", premaat: "", premaatP: "12", seguroRC: "", seguroRCP: "1", cuotas: "", cuotasP: "12", impPct: "", impIngresos: "", imagen: "", imagenP: "12", office: "", officeP: "12", icloud: "", icloudP: "12", holded: "", holdedP: "12", publi: "", publiP: "12", otrasApps: "", otrasAppsP: "12", amortLocal: "", amortLocalP: "12", arrendLocal: "", arrendLocalP: "12", telefonia: "", telefoniaP: "12", suministros: "", suministrosP: "12", impLocal: "", impLocalP: "12", coche: "", cocheP: "12", amortInf: "", amortInfP: "12", amortOtros: "", amortOtrosP: "12", otrasAmort: "", otrasAmortP: "12", consumibles: "", consumiblesP: "12", papeleria: "", papeleriaP: "12", salario: "", salarioP: "12", hEfDia: "", diasEf: "", hRealDia: "", diasReales: "" });
const mkCK = () => ({ compra: "", kmTotales: "", anios: "", kmNeum: "", costeNeum: "", kmAceite: "", costeAceite: "", otrasRev: "", reparac: "", seguro: "", impuestos: "", amortGaraje: "", arrendGaraje: "", consumo: "", precioComb: "", pctNoEfectivos: "" });
const mkObra = () => ({ promotor: "", ubicacion: "", pem: "", superficie: "", distancia: "", velocidad: "110" });
const mkFO = () => [
  { nombre: "Entrevista previa / toma de datos", visitas: "", tiempo: "2", coef: "1" },
  { nombre: "Entrega del presupuesto", visitas: "", tiempo: "1", coef: "1" },
  { nombre: "Revisión del presupuesto", visitas: "", tiempo: "0.5", coef: "1" },
  { nombre: "Formalización contrato", visitas: "", tiempo: "1", coef: "1" },
  { nombre: "Antes del inicio de la obra", visitas: "", tiempo: "1", coef: "1" },
  { nombre: "Inicio de la obra", visitas: "", tiempo: "1", coef: "1" },
  { nombre: "Movimiento de tierras", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Cimentación", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Estructura", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Albañilería", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Instalación eléctrica", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Instalación de fontanería", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Otras instalaciones", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Cubiertas", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Carpintería de madera", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Carpintería de aluminio y met.", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Pintura", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Pruebas de servicio", visitas: "", tiempo: "1.5", coef: "1" },
  { nombre: "Entrega de obra", visitas: "", tiempo: "1", coef: "1" },
  { nombre: "Revisión anual", visitas: "", tiempo: "1", coef: "1" },
  { nombre: "Revisión trianual", visitas: "", tiempo: "1", coef: "1" },
  { nombre: "Revisión decenal", visitas: "", tiempo: "1", coef: "1" },
];
const mkFOf = () => [
  { nombre: "Análisis encargo / Redacción presupuesto", dias: "", tiempo: "1" },
  { nombre: "Estudio Proyecto", dias: "", tiempo: "2" },
  { nombre: "Elaboración Plan de Control", dias: "", tiempo: "5" },
  { nombre: "Elaboración documentación previa", dias: "", tiempo: "5" },
  { nombre: "Documentar proceso constructivo", dias: "", tiempo: "1" },
  { nombre: "Registros de Calidad", dias: "", tiempo: "3" },
  { nombre: "Final de Obra", dias: "", tiempo: "5" },
  { nombre: "Trámites en Ayuntamientos", dias: "", tiempo: "1" },
  { nombre: "Reuniones con contratistas", dias: "", tiempo: "1" },
  { nombre: "Reuniones/visitas a proveedores", dias: "", tiempo: "1" },
  { nombre: "Trámites en laboratorios", dias: "", tiempo: "1" },
];
const mkVis = () => [
  { concepto: "DEO", uds: "1", coste: "" },
  { concepto: "CSS", uds: "1", coste: "" },
  { concepto: "CC", uds: "1", coste: "" },
  { concepto: "ESS", uds: "1", coste: "" },
  { concepto: "Seguro RC encargo", uds: "1", coste: "" },
];
const mkOtros = () => [
  { concepto: "Tren", uds: "", precio: "" },
  { concepto: "Dietas", uds: "", precio: "" },
  { concepto: "Hotel + Uber", uds: "", precio: "" },
  { concepto: "Parking", uds: "", precio: "" },
];

// ─── Build H wizard steps — OBRA only ────────────────────────────────────────
function buildObraSteps() {
  return [
    { type: "section", label: "Datos de la Obra" },
    { hkey: "obra", field: "promotor",   label: "Nombre del promotor o cliente",          isText: true, optional: false },
    { hkey: "obra", field: "ubicacion",  label: "Ubicación de la obra",                   isText: true, optional: false },
    { hkey: "obra", field: "distancia",  label: "Distancia desde tu despacho hasta la obra", suffix: "km",   optional: false },
    { hkey: "obra", field: "velocidad",  label: "Velocidad media de desplazamiento",      suffix: "km/h", optional: true, hint: "Con la distancia y la velocidad calcularemos el tiempo de cada desplazamiento" },
    { hkey: "obra", field: "superficie", label: "Superficie construida",                  suffix: "m²",   optional: true },
    { hkey: "obra", field: "pem",        label: "PEM — Presupuesto de Ejecución Material", suffix: "€",   optional: false },
  ];
}

// ─── Build H wizard steps — TRABAJO A PIE DE OBRA ────────────────────────────
function buildFOSteps(fO) {
  const s = [
    {
      type: "message",
      title: "Ahora vamos a pedir la dedicación en obra",
      body: "Para cada fase del proyecto indicaremos el número de visitas previstas y el tiempo estimado por visita.\n\nCon estos datos, junto con el Coste/Hora y el Coste/Km, calcularemos el coste total del trabajo a pie de obra, incluyendo tanto el tiempo profesional como los desplazamientos.",
      accent: "#a78bfa",
      icon: "👷",
    },
    { type: "section", label: "Trabajo a Pie de Obra" },
  ];
  fO.forEach((f, i) => s.push({
    hkey: "fO", idx: i, field: "visitas",
    label: f.nombre,
    sublabel: `Tiempo estimado por visita: ${f.tiempo} h`,
    suffix: "visitas", optional: true,
  }));
  s.push({ type: "summary", summaryType: "obra" });
  return s;
}

// ─── Build H wizard steps — OFICINA TÉCNICA ──────────────────────────────────
function buildFOfSteps(fOf) {
  const s = [
    { type: "section", label: "Trabajo de Oficina Técnica y Gestiones" },
  ];
  fOf.forEach((f, i) => s.push({
    hkey: "fOf", idx: i, field: "dias",
    label: f.nombre,
    sublabel: `Tiempo estimado por día: ${f.tiempo} h`,
    suffix: "días", optional: true,
  }));
  s.push({ type: "summary", summaryType: "oficina" });
  return s;
}

// ─── Build H wizard steps — VISADOS ──────────────────────────────────────────
function buildVisSteps(vis) {
  const s = [{ type: "section", label: "Gastos de Visado y Registro" }];
  vis.forEach((v, i) => s.push({ hkey: "vis", idx: i, field: "coste", label: `Visado — ${v.concepto}`, suffix: "€", optional: true }));
  return s;
}

// ─── OtrosWizard — otros gastos + gastos libres adicionales ──────────────────
function OtrosWizard({ otros, setOtros, liveTotal, onComplete }) {
  // Phase: "intro" | "fields" (predefined one by one) | "extras" (free-form add)
  const [phase, setPhase] = useState("intro");
  const [idx, setIdx] = useState(0);
  const [val, setVal] = useState("");
  const [val2, setVal2] = useState(""); // precio for current item
  const [err, setErr] = useState("");
  const [extraNombre, setExtraNombre] = useState("");
  const [extraUds, setExtraUds] = useState("");
  const [extraPrecio, setExtraPrecio] = useState("");
  const [extraErr, setExtraErr] = useState("");
  const ref = useRef(null);
  const refNombre = useRef(null);

  // Predefined items: ask uds then precio for each
  // We flatten into steps: for each g → step "uds", then step "precio"
  const predSteps = [];
  otros.forEach((g, i) => {
    predSteps.push({ idx: i, field: "uds",    label: `${g.concepto}`, sublabel: "¿Cuántas unidades?", suffix: "uds." });
    predSteps.push({ idx: i, field: "precio", label: `${g.concepto}`, sublabel: "¿Precio por unidad?", suffix: "€/ud." });
  });

  useEffect(() => {
    if (phase === "fields" && predSteps[idx]) {
      const step = predSteps[idx];
      setVal(otros[step.idx]?.[step.field] ?? "");
      setErr("");
      setTimeout(() => ref.current?.focus(), 60);
    }
    if (phase === "extras") {
      setTimeout(() => refNombre.current?.focus(), 60);
    }
  }, [idx, phase]);

  const commitField = (v) => {
    const step = predSteps[idx];
    setOtros(arr => arr.map((r, j) => j === step.idx ? { ...r, [step.field]: v } : r));
  };

  const advanceField = () => {
    commitField(val);
    if (idx + 1 >= predSteps.length) setPhase("extras");
    else setIdx(idx + 1);
  };
  const skipField = () => { commitField("0"); if (idx + 1 >= predSteps.length) setPhase("extras"); else setIdx(idx + 1); };
  const backField = () => { if (idx > 0) setIdx(idx - 1); };
  const onKey = (e) => { if (e.key === "Enter") { e.preventDefault(); advanceField(); } };

  const addExtra = () => {
    if (!extraNombre.trim()) { setExtraErr("Indica el nombre del gasto."); return; }
    setOtros(arr => [...arr, { concepto: extraNombre.trim(), uds: extraUds || "1", precio: extraPrecio || "0" }]);
    setExtraNombre(""); setExtraUds(""); setExtraPrecio(""); setExtraErr("");
    setTimeout(() => refNombre.current?.focus(), 60);
  };
  const removeExtra = (i) => setOtros(arr => arr.filter((_, j) => j !== i));

  const total = liveTotal();

  useEffect(() => {
    if (phase !== "intro") return;
    const onKey = (e) => { if (e.key === "Enter") setPhase("fields"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // ── Intro ──
  if (phase === "intro") {
    const propuestas = otros.map(g => g.concepto);
    return (
      <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
        <div style={{ width: "100%", maxWidth: 540 }}>
          <div style={{ background: C.surf, border: `2px solid ${C.yText}44`, borderRadius: 16, padding: "38px 40px", boxShadow: "0 12px 48px #00000070" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🧾</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 12, background: `linear-gradient(130deg, ${C.yText} 20%, ${C.text} 80%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Otros Gastos Directos del Encargo
            </h2>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 20 }}>
              Ahora necesitamos que nos indiques otros gastos directos del encargo. Se indican a continuación algunas propuestas:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
              {propuestas.map((p, i) => (
                <div key={i} style={{ background: C.yText + "14", border: `1px solid ${C.yText}33`, borderRadius: 20, padding: "5px 14px", fontSize: 12, color: C.yText }}>
                  {p}
                </div>
              ))}
              <div style={{ background: C.yText + "14", border: `1px dashed ${C.yText}44`, borderRadius: 20, padding: "5px 14px", fontSize: 12, color: C.muted }}>
                + Otros que quieras añadir
              </div>
            </div>
            <button
              onClick={() => setPhase("fields")}
              style={{ width: "100%", background: C.yBorder, border: "none", borderRadius: 10, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Empezar →
            </button>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#232d40" }}>
              <kbd style={{ background: "#151e2e", border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 5px", fontSize: 10, color: "#2a3a50" }}>Enter</kbd> para continuar
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "fields") {
    const step = predSteps[idx];
    const cur = otros[step?.idx];
    const pct = Math.round(((idx + 1) / predSteps.length) * 100);
    return (
      <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
        <div style={{ width: "100%", maxWidth: 540, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: C.mono }}>Otros Gastos Directos</span>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: C.mono }}>{Math.floor(idx / 2) + 1} / {otros.length}</span>
          </div>
          <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
            <div style={{ height: "100%", width: pct + "%", background: C.yText, borderRadius: 2, transition: "width 0.3s" }} />
          </div>
          <div style={{ marginTop: 7, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: C.yText, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Otros Gastos Directos del Encargo</span>
            {total > 0 && <span style={{ fontSize: 13, fontFamily: C.mono, color: C.accent, fontWeight: 700 }}>{fmt(total)} €</span>}
          </div>
        </div>

        <div style={{ width: "100%", maxWidth: 540, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: "34px 38px", boxShadow: "0 12px 48px #00000070" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#161e2e", border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 12px", fontSize: 10, color: C.muted, fontFamily: C.mono, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span style={{ opacity: 0.5 }}>○</span> opcional — puedes poner 0 o saltar
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, marginBottom: 4, letterSpacing: "-0.02em" }}>{step?.label}</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>{step?.sublabel}</div>

          <div style={{ position: "relative", marginBottom: 6 }}>
            <input ref={ref} type="number" value={val} placeholder="0" step="1"
              onChange={e => setVal(e.target.value)} onKeyDown={onKey}
              style={{ width: "100%", background: "#0a1220", border: `2px solid ${C.yBorder}`, borderRadius: 9, padding: "13px 72px 13px 14px", fontSize: 28, fontFamily: C.mono, color: C.yText, outline: "none" }}
              onFocus={e => { e.target.style.borderColor = C.yText; }}
              onBlur={e => { e.target.style.borderColor = C.yBorder; }}
            />
            <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.muted, fontFamily: C.mono }}>{step?.suffix}</span>
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
            <button onClick={advanceField} style={{ flex: 1, background: C.yBorder, border: "none", borderRadius: 9, padding: "13px", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              {idx + 1 >= predSteps.length ? "Continuar →" : "Siguiente →"}
            </button>
            <button onClick={skipField} style={{ padding: "13px 16px", background: "none", border: `1px solid ${C.border}`, borderRadius: 9, color: C.muted, fontSize: 13, cursor: "pointer" }}>Saltar</button>
            {idx > 0 && <button onClick={backField} style={{ padding: "13px 14px", background: "none", border: `1px solid ${C.border}`, borderRadius: 9, color: C.muted, fontSize: 13, cursor: "pointer" }}>←</button>}
          </div>
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#232d40" }}>
            <kbd style={{ background: "#151e2e", border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 5px", fontSize: 10, color: "#2a3a50" }}>Enter</kbd> para avanzar
          </div>
        </div>
      </div>
    );
  }

  // phase === "extras"
  const extras = otros.filter((_, i) => i >= 4); // items beyond the 4 predefined
  return (
    <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: C.mono }}>Otros Gastos Directos</span>
            {total > 0 && <span style={{ fontSize: 13, fontFamily: C.mono, color: C.accent, fontWeight: 700 }}>{fmt(total)} €</span>}
          </div>
          <div style={{ height: 3, background: C.yText, borderRadius: 2 }} />
          <div style={{ marginTop: 7, fontSize: 10, color: C.yText, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Gastos adicionales</div>
        </div>

        <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 32px", boxShadow: "0 12px 48px #00000070" }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em" }}>¿Hay algún otro gasto?</div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>
            Añade cualquier gasto directo del encargo que no figure en la lista anterior: peritos, ensayos, desplazamientos especiales, etc. Si no hay más gastos, pulsa <strong style={{ color: C.text }}>Finalizar</strong>.
          </p>

          {/* Extras ya añadidos */}
          {extras.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {extras.map((g, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f1828", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: C.text }}>{g.concepto}</span>
                  <span style={{ fontFamily: C.mono, color: C.yText, marginLeft: 16 }}>
                    {g.uds} ud. × {g.precio} € = {fmt((parseFloat(g.uds) || 0) * (parseFloat(g.precio) || 0))} €
                  </span>
                  <button onClick={() => removeExtra(4 + i)} style={{ background: "none", border: "none", color: "#773333", cursor: "pointer", fontSize: 14, marginLeft: 10 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Formulario añadir nuevo */}
          <div style={{ background: "#0a1220", border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px" }}>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Añadir gasto</div>
            <input ref={refNombre} type="text" value={extraNombre} placeholder="Nombre del gasto (ej. Ensayo geotécnico)"
              onChange={e => setExtraNombre(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }}
              style={{ width: "100%", background: "#0d1525", border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px 12px", color: C.text, fontSize: 14, marginBottom: 10, outline: "none", fontFamily: C.sans }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <input type="number" value={extraUds} placeholder="1" step="1"
                  onChange={e => setExtraUds(e.target.value)}
                  style={{ width: "100%", background: "#0d1525", border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px 44px 10px 12px", color: C.text, fontSize: 14, outline: "none", fontFamily: C.mono }} />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.muted }}>uds.</span>
              </div>
              <div style={{ position: "relative" }}>
                <input type="number" value={extraPrecio} placeholder="0" step="0.01"
                  onChange={e => setExtraPrecio(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }}
                  style={{ width: "100%", background: "#0d1525", border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px 44px 10px 12px", color: C.text, fontSize: 14, outline: "none", fontFamily: C.mono }} />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.muted }}>€/ud.</span>
              </div>
            </div>
            {extraErr && <div style={{ fontSize: 12, color: "#e05050", fontFamily: C.mono, marginTop: 6 }}>{extraErr}</div>}
            <button onClick={addExtra} style={{ marginTop: 12, width: "100%", background: "#1a2a3a", border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px", color: C.text, fontSize: 13, cursor: "pointer" }}>
              + Añadir gasto
            </button>
          </div>

          <button onClick={onComplete}
            style={{ marginTop: 16, width: "100%", background: C.accent, border: "none", borderRadius: 9, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Finalizar y ver resultado ✓
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Generic Wizard ───────────────────────────────────────────────────────────
function Wizard({ steps, data, setData, onComplete, title, accent }) {
  // Include message steps in navigation flow, exclude only pure section headers
  const fields = steps.filter(s => s.type !== "section");
  const [idx, setIdx] = useState(0);
  const [val, setVal] = useState("");
  const [valP, setValP] = useState("");
  const [err, setErr] = useState("");
  const ref = useRef(null);

  const cur = fields[idx];
  const isMessage = cur?.type === "message";

  // Find section name for current field
  let section = "";
  for (const s of steps) {
    if (s.type === "section") section = s.label;
    if (s === cur) break;
  }

  useEffect(() => {
    if (!cur || isMessage) return;
    setVal(data[cur.key] ?? "");
    setValP(data[cur.keyP] ?? (cur.defaultP || "12"));
    setErr("");
    setTimeout(() => ref.current?.focus(), 60);
  }, [idx]);

  const commit = () => {
    if (isMessage) return data;
    const upd = { ...data, [cur.key]: val };
    if (cur.keyP) upd[cur.keyP] = valP;
    setData(upd);
    return upd;
  };

  const advance = () => {
    if (!isMessage) {
      if (!cur.optional && !cur.isText && val.trim() === "") { setErr("Este campo es obligatorio."); return; }
      if (!cur.optional && cur.isText && val.trim() === "") { setErr("Campo obligatorio."); return; }
    }
    const upd = commit();
    setErr("");
    if (idx + 1 >= fields.length) onComplete(upd);
    else setIdx(idx + 1);
  };

  const skip = () => {
    const upd = { ...data, [cur.key]: "" };
    if (cur.keyP) upd[cur.keyP] = cur.defaultP || "12";
    setData(upd);
    if (idx + 1 >= fields.length) onComplete(upd);
    else setIdx(idx + 1);
  };

  const back = () => { if (idx > 0) setIdx(idx - 1); };
  const onKey = (e) => { if (e.key === "Enter") { e.preventDefault(); advance(); } };

  if (!cur) return null;
  // For progress bar, don't count message steps as "content" steps
  const contentFields = fields.filter(f => f.type !== "message");
  const contentIdx = contentFields.indexOf(cur);
  const pct = isMessage ? 0 : Math.round(((contentIdx + 1) / contentFields.length) * 100);

  // ── Message card ──
  if (isMessage) {
    return (
      <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
        <div style={{ width: "100%", maxWidth: 540 }}>
          <div style={{ background: C.surf, border: `2px solid ${(cur.accent || accent)}44`, borderRadius: 16, padding: "38px 40px", boxShadow: "0 12px 48px #00000070" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>{cur.icon}</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 18, background: `linear-gradient(130deg, ${cur.accent || accent} 20%, ${C.text} 80%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {cur.title}
            </h2>
            {cur.body.split("\n\n").map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 12 }}>{para}</p>
            ))}
            <button onClick={advance}
              style={{ marginTop: 10, width: "100%", background: cur.accent || accent, border: "none", borderRadius: 10, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Entendido, empezar →
            </button>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#232d40" }}>
              <kbd style={{ background: "#151e2e", border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 5px", fontSize: 10, color: "#2a3a50" }}>Enter</kbd> para continuar
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
      {/* Progress */}
      <div style={{ width: "100%", maxWidth: 540, marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontSize: 11, color: C.muted, fontFamily: C.mono }}>{title}</span>
          <span style={{ fontSize: 11, color: C.muted, fontFamily: C.mono }}>{idx + 1} / {fields.length}</span>
        </div>
        <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
          <div style={{ height: "100%", width: pct + "%", background: accent, borderRadius: 2, transition: "width 0.3s ease" }} />
        </div>
        <div style={{ marginTop: 7, fontSize: 10, color: accent, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>{section}</div>
      </div>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 540, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: "34px 38px", boxShadow: "0 12px 48px #00000070" }}>
        {cur.optional && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#161e2e", border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 12px", fontSize: 10, color: C.muted, fontFamily: C.mono, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span style={{ opacity: 0.5 }}>○</span> opcional — puedes saltar
          </div>
        )}

        <div style={{ fontSize: cur.label.length > 45 ? 18 : 22, fontWeight: 700, lineHeight: 1.3, marginBottom: 6, letterSpacing: "-0.02em" }}>
          {cur.label}
        </div>
        {cur.sublabel && <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{cur.sublabel}</div>}
        {cur.hint && (
          <div style={{ background: "#0f1828", borderLeft: `3px solid ${accent}`, borderRadius: "0 6px 6px 0", padding: "8px 12px", fontSize: 12, color: C.muted, marginBottom: 18 }}>
            💡 {cur.hint}
          </div>
        )}

        {cur.keyP ? (
          // Pair input
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: C.gText, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Importe (€)</div>
              <div style={{ position: "relative" }}>
                <input ref={ref} type="number" value={val} placeholder="0,00" step="0.01"
                  onChange={e => setVal(e.target.value)} onKeyDown={onKey}
                  style={{ width: "100%", background: C.gBg, border: `2px solid ${C.gBorder}`, borderRadius: 9, padding: "13px 44px 13px 14px", fontSize: 22, fontFamily: C.mono, color: C.gText, outline: "none" }} />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#3a6a3a" }}>€</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.yText, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Pagos al año</div>
              <div style={{ position: "relative" }}>
                <input type="number" value={valP} placeholder="12" step="1" min="1"
                  onChange={e => setValP(e.target.value)} onKeyDown={onKey}
                  style={{ width: "100%", background: C.yBg, border: `2px solid ${C.yBorder}`, borderRadius: 9, padding: "13px 40px 13px 14px", fontSize: 22, fontFamily: C.mono, color: C.yText, outline: "none" }} />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#6a5010" }}>×/año</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ position: "relative", marginBottom: 6 }}>
            <input
              ref={ref}
              type={cur.isText ? "text" : "number"}
              value={val}
              placeholder={cur.isText ? "Escribe aquí…" : "0"}
              step={cur.suffix?.includes("h") ? "0.5" : "1"}
              onChange={e => setVal(e.target.value)}
              onKeyDown={onKey}
              style={{ width: "100%", background: "#0a1220", border: `2px solid ${accent}55`, borderRadius: 9, padding: cur.suffix ? "13px 68px 13px 14px" : "13px 14px", fontSize: cur.isText ? 18 : 28, fontFamily: cur.isText ? C.sans : C.mono, color: C.text, outline: "none", transition: "border-color 0.15s" }}
              onFocus={e => { e.target.style.borderColor = accent; }}
              onBlur={e => { e.target.style.borderColor = accent + "55"; }}
            />
            {cur.suffix && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.muted, fontFamily: C.mono, pointerEvents: "none" }}>{cur.suffix}</span>}
          </div>
        )}

        {err && <div style={{ fontSize: 12, color: "#e05050", fontFamily: C.mono, marginBottom: 8 }}>{err}</div>}

        <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
          <button onClick={advance}
            style={{ flex: 1, background: accent, border: "none", borderRadius: 9, padding: "13px", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            {idx + 1 === fields.length ? "Finalizar ✓" : "Siguiente →"}
          </button>
          {cur.optional && (
            <button onClick={skip}
              style={{ padding: "13px 16px", background: "none", border: `1px solid ${C.border}`, borderRadius: 9, color: C.muted, fontSize: 13, cursor: "pointer" }}>
              Saltar
            </button>
          )}
          {idx > 0 && (
            <button onClick={back}
              style={{ padding: "13px 14px", background: "none", border: `1px solid ${C.border}`, borderRadius: 9, color: C.muted, fontSize: 13, cursor: "pointer" }}>
              ←
            </button>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#232d40" }}>
          <kbd style={{ background: "#151e2e", border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 5px", fontSize: 10, color: "#2a3a50" }}>Enter</kbd> para avanzar
        </div>
      </div>
    </div>
  );
}

// ─── Honorarios wizard (nested state, multi-phase) ────────────────────────────
function HWizard({ ch, ck, onComplete }) {
  const [obra,  setObra]  = useState(mkObra());
  const [fO,    setFO]    = useState(mkFO());
  const [fOf,   setFOf]   = useState(mkFOf());
  const [vis,   setVis]   = useState(mkVis());
  const [otros, setOtros] = useState(mkOtros());

  // sub-screens: "obra_intro"|"obra"|"fo_intro"|"fo"|"of_intro"|"of"|"visados_intro"|"visados_otros"
  const [phase, setPhase] = useState("obra_intro");

  // Shared commit helper used by sub-wizards
  const commit = (step, v) => {
    if (step.hkey === "obra")  setObra( d   => ({ ...d, [step.field]: v }));
    if (step.hkey === "fO")    setFO(   arr => arr.map((r,j) => j===step.idx ? {...r,[step.field]:v} : r));
    if (step.hkey === "fOf")   setFOf(  arr => arr.map((r,j) => j===step.idx ? {...r,[step.field]:v} : r));
    if (step.hkey === "vis")   setVis(  arr => arr.map((r,j) => j===step.idx ? {...r,[step.field]:v} : r));
    if (step.hkey === "otros") setOtros(arr => arr.map((r,j) => j===step.idx ? {...r,[step.field]:v} : r));
  };

  const liveTotal = () => calcHonorarios(obra, fO, fOf, vis, otros, ch, ck).total;

  if (phase === "obra_intro") return (
    <IntroScreen
      step="3 / 3"
      title="Datos de la Obra"
      subtitle="Indica los datos básicos del encargo: promotor, ubicación, distancia a la obra y presupuesto. Con la distancia y la velocidad calcularemos automáticamente el tiempo de cada desplazamiento."
      accent={C.accent}
      icon="🏗"
      items={["Promotor / cliente", "Ubicación", "Distancia a la obra", "Velocidad de desplazamiento", "Superficie construida", "PEM del proyecto"]}
      onStart={() => setPhase("obra")}
    />
  );

  if (phase === "obra") return (
    <SubWizard
      steps={buildObraSteps()}
      commit={commit}
      readVal={(step) => obra[step.field] ?? ""}
      title="Datos de la Obra"
      accent={C.accent}
      liveTotal={liveTotal}
      obra={obra} ch={ch} ck={ck}
      onComplete={() => setPhase("fo_intro")}
      extraInfo={(step) => {
        if (step.field === "velocidad" && obra.distancia) {
          const vel = parseFloat(obra.velocidad) || 110;
          const dist = parseFloat(obra.distancia) || 0;
          const mins = Math.round((dist / vel) * 60);
          return `⏱ Tiempo de desplazamiento estimado: ${mins} min por trayecto`;
        }
        return null;
      }}
    />
  );

  if (phase === "fo_intro") return (
    <IntroScreen
      step="3 / 3"
      title="Trabajo a Pie de Obra"
      subtitle="Ahora indicaremos el número de visitas previstas para cada fase de la obra. Para cada una se mostrará el tiempo estimado por visita que puedes ajustar si lo necesitas."
      accent="#a78bfa"
      icon="👷"
      items={fO.map(f => f.nombre)}
      onStart={() => setPhase("fo")}
    />
  );

  if (phase === "fo") return (
    <SubWizard
      steps={buildFOSteps(fO)}
      commit={commit}
      readVal={(step) => fO[step.idx]?.[step.field] ?? ""}
      title="Trabajo a Pie de Obra"
      accent="#a78bfa"
      liveTotal={liveTotal}
      fO={fO} ch={ch} ck={ck} obra={obra}
      onComplete={() => setPhase("of_intro")}
    />
  );

  if (phase === "of_intro") return (
    <IntroScreen
      step="3 / 3"
      title="Trabajo de Oficina Técnica y Gestiones"
      subtitle="Ahora indicaremos los días dedicados a cada tarea de oficina: redacción de documentación, registros de calidad, gestiones administrativas y trámites. Para cada tarea se muestra el tiempo estimado por día."
      accent="#38bdf8"
      icon="📋"
      items={mkFOf().map(f => f.nombre)}
      onStart={() => setPhase("of")}
    />
  );

  if (phase === "of") return (
    <SubWizard
      steps={buildFOfSteps(fOf)}
      commit={commit}
      readVal={(step) => fOf[step.idx]?.[step.field] ?? ""}
      title="Trabajo de Oficina Técnica"
      accent="#38bdf8"
      liveTotal={liveTotal}
      fOf={fOf} ch={ch} ck={ck} obra={obra}
      onComplete={() => setPhase("visados_intro")}
    />
  );

  if (phase === "visados_intro") return (
    <IntroScreen
      step="3 / 3"
      title="Gastos de Visado y Registro"
      subtitle="Indica el coste de cada visado o registro colegial necesario para el encargo. Si alguno no aplica, puedes dejarlo en cero o saltarlo."
      accent="#f472b6"
      icon="📑"
      items={["DEO", "CSS", "CC", "ESS", "Seguro RC encargo"]}
      onStart={() => setPhase("visados")}
    />
  );

  if (phase === "visados") return (
    <SubWizard
      steps={buildVisSteps(vis)}
      commit={commit}
      readVal={(step) => vis[step.idx]?.[step.field] ?? ""}
      title="Gastos de Visado y Registro"
      accent="#f472b6"
      liveTotal={liveTotal}
      onComplete={() => setPhase("otros_intro")}
    />
  );

  if (phase === "otros_intro") return (
    <IntroScreen
      step="3 / 3"
      title="Otros Gastos Directos del Encargo"
      subtitle="Por último, indica cualquier gasto directo asociado al encargo: desplazamientos en tren, dietas, hotel, parking u otros gastos que quieras añadir. Puedes introducir tantos como necesites."
      accent={C.yText}
      icon="🧾"
      items={["Tren", "Dietas", "Hotel + Uber", "Parking", "+ Gastos adicionales libres"]}
      onStart={() => setPhase("otros")}
    />
  );

  if (phase === "otros") return (
    <OtrosWizard
      otros={otros}
      setOtros={setOtros}
      liveTotal={liveTotal}
      onComplete={() => setPhase("revision")}
    />
  );

  if (phase === "revision") return (
    <RevisionPrecio
      total={liveTotal()}
      pem={parseFloat(obra.pem) || 0}
      onConfirm={(precioFinal) => onComplete({ obra, fO, fOf, vis, otros, precioFinal })}
    />
  );

  return null;
}

// ─── Revisión de precio ───────────────────────────────────────────────────────
function RevisionPrecio({ total, pem, onConfirm }) {
  const [usarCalculado, setUsarCalculado] = useState(null); // null | true | false
  const [precioManual, setPrecioManual] = useState("");
  const [err, setErr] = useState("");
  const ref = useRef(null);
  const pctCalculado = pem > 0 ? (total / pem) * 100 : 0;
  const precioManualNum = parseFloat(precioManual) || 0;
  const pctManual = pem > 0 ? (precioManualNum / pem) * 100 : 0;

  useEffect(() => {
    if (usarCalculado === false) setTimeout(() => ref.current?.focus(), 80);
  }, [usarCalculado]);

  const confirmar = () => {
    if (usarCalculado === null) { setErr("Indica si el precio calculado es correcto."); return; }
    if (usarCalculado === false && precioManualNum <= 0) { setErr("Introduce el precio que quieres proponer."); return; }
    onConfirm(usarCalculado ? total : precioManualNum);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
      <div style={{ width: "100%", maxWidth: 540 }}>

        {/* Precio calculado */}
        <div style={{ background: C.surf, border: `2px solid ${C.accent}55`, borderRadius: 16, padding: "28px 32px", marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Precio calculado</div>
          <div style={{ fontSize: 52, fontFamily: C.mono, fontWeight: 800, color: C.accent, lineHeight: 1, marginBottom: 8 }}>
            {Number(total).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          {pctCalculado > 0 && (
            <div style={{ fontSize: 13, color: C.muted }}>
              <span style={{ fontFamily: C.mono, color: C.accent }}>{Number(pctCalculado).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
              {" "}sobre PEM · PEM: {Number(pem).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
          )}
        </div>

        {/* Pregunta */}
        <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 14, padding: "24px 28px" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em" }}>
            ¿Es correcto este presupuesto?
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
            Si quieres modificarlo, indica el precio que vas a proponer al cliente.
          </div>

          {/* Opciones */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <button
              onClick={() => { setUsarCalculado(true); setErr(""); }}
              style={{ padding: "14px", borderRadius: 10, border: `2px solid ${usarCalculado === true ? C.gBorder : C.border}`, background: usarCalculado === true ? C.gBg : "#0a1220", color: usarCalculado === true ? C.gText : C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
              ✓ Sí, es correcto
            </button>
            <button
              onClick={() => { setUsarCalculado(false); setErr(""); }}
              style={{ padding: "14px", borderRadius: 10, border: `2px solid ${usarCalculado === false ? C.yBorder : C.border}`, background: usarCalculado === false ? C.yBg : "#0a1220", color: usarCalculado === false ? C.yText : C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
              ✎ Quiero modificarlo
            </button>
          </div>

          {/* Campo precio manual */}
          {usarCalculado === false && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.yText, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                ¿Qué precio quieres proponer?
              </div>
              <div style={{ position: "relative" }}>
                <input
                  ref={ref}
                  type="number"
                  value={precioManual}
                  placeholder="0,00"
                  step="100"
                  onChange={e => { setPrecioManual(e.target.value); setErr(""); }}
                  onKeyDown={e => { if (e.key === "Enter") confirmar(); }}
                  style={{ width: "100%", background: C.yBg, border: `2px solid ${C.yBorder}`, borderRadius: 9, padding: "13px 56px 13px 14px", fontSize: 28, fontFamily: C.mono, color: C.yText, outline: "none" }}
                />
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#6a5010", fontFamily: C.mono }}>€</span>
              </div>
              {precioManualNum > 0 && pem > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: C.muted, fontFamily: C.mono }}>
                  → <span style={{ color: C.yText, fontWeight: 700 }}>{Number(pctManual).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span> sobre PEM
                  {precioManualNum < total && (
                    <span style={{ color: "#ff7070", marginLeft: 12 }}>
                      ({Number(((precioManualNum - total) / total) * 100).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% respecto al calculado)
                    </span>
                  )}
                  {precioManualNum > total && (
                    <span style={{ color: C.gText, marginLeft: 12 }}>
                      (+{Number(((precioManualNum - total) / total) * 100).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% respecto al calculado)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {err && <div style={{ fontSize: 12, color: "#e05050", fontFamily: C.mono, marginBottom: 10 }}>{err}</div>}

          <button
            onClick={confirmar}
            style={{ width: "100%", background: usarCalculado === true ? C.gBorder : usarCalculado === false ? C.yBorder : C.border, border: "none", borderRadius: 10, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
            Ver resultado final →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SubWizard — generic field-by-field navigator ─────────────────────────────
function SubWizard({ steps, commit, readVal, title, accent, liveTotal, onComplete, extraInfo, fO, fOf, ch, ck, obra }) {
  const fields = steps.filter(s => s.type !== "section");
  const [idx,  setIdx]  = useState(0);
  const [val,  setVal]  = useState(() => { const f = fields[0]; return f?.type === "message" || f?.type === "summary" ? "" : (readVal(f) || ""); });
  const [err,  setErr]  = useState("");
  const ref = useRef(null);

  const cur = fields[idx];
  const isMessage = cur?.type === "message";
  const isSummary = cur?.type === "summary";

  let section = "";
  for (const s of steps) { if (s.type === "section") section = s.label; if (s === cur) break; }

  useEffect(() => {
    if (!cur || isMessage || isSummary) return;
    setVal(readVal(cur) || "");
    setErr("");
    setTimeout(() => ref.current?.focus(), 60);
  }, [idx]);

  const advance = () => {
    if (!isMessage && !isSummary) {
      if (!cur.optional && !cur.isText && val.trim() === "") { setErr("Campo obligatorio."); return; }
      if (!cur.optional &&  cur.isText && val.trim() === "") { setErr("Campo obligatorio."); return; }
      commit(cur, val);
    }
    setErr("");
    if (idx + 1 >= fields.length) onComplete();
    else setIdx(idx + 1);
  };

  const skip = () => { commit(cur, "0"); if (idx + 1 >= fields.length) onComplete(); else setIdx(idx + 1); };
  const back = () => { if (idx > 0) setIdx(idx - 1); };
  const onKey = (e) => { if (e.key === "Enter") { e.preventDefault(); advance(); } };

  const contentFields = fields.filter(f => f.type !== "message" && f.type !== "summary");
  const contentIdx = contentFields.indexOf(cur);
  const pct = (isMessage || isSummary) ? 100 : Math.round(((contentIdx + 1) / contentFields.length) * 100);
  const total = liveTotal();
  const extra = extraInfo?.(cur);

  // ── Message card ──
  if (isMessage) {
    return (
      <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
        <div style={{ width: "100%", maxWidth: 540 }}>
          <div style={{ background: C.surf, border: `2px solid ${(cur.accent || accent)}44`, borderRadius: 16, padding: "38px 40px", boxShadow: "0 12px 48px #00000070" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>{cur.icon}</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 18, background: `linear-gradient(130deg, ${cur.accent || accent} 20%, ${C.text} 80%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {cur.title}
            </h2>
            {cur.body.split("\n\n").map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 12 }}>{para}</p>
            ))}
            <button onClick={advance}
              style={{ marginTop: 10, width: "100%", background: cur.accent || accent, border: "none", borderRadius: 10, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Entendido, empezar →
            </button>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#232d40" }}>
              <kbd style={{ background: "#151e2e", border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 5px", fontSize: 10, color: "#2a3a50" }}>Enter</kbd> para continuar
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Summary card ──
  if (isSummary) {
    const isObra = cur.summaryType === "obra";
    const summAccent = isObra ? "#a78bfa" : "#38bdf8";
    const icon = isObra ? "👷" : "📋";
    const tituloBloque = isObra ? "Trabajo a Pie de Obra" : "Trabajo de Oficina Técnica";

    // Calculate block totals
    let filas = [];
    let totalVisitas = 0, totalDias = 0, totalCoste = 0;
    const dist = parseFloat(obra?.distancia) || 0;
    const vel  = parseFloat(obra?.velocidad) || 110;
    const tDesp = vel > 0 ? dist / vel : 0;

    if (isObra && fO) {
      filas = fO.map(f => {
        const nv = parseFloat(f.visitas) || 0;
        const h  = parseFloat(f.tiempo)  || 0;
        const coef = parseFloat(f.coef)  || 1;
        const prof = nv * h * (ch || 0);
        const desp = nv * dist * 2 * (ck || 0) * coef + nv * tDesp * 2 * (ch || 0) * coef;
        return { nombre: f.nombre, visitas: nv, tiempo: h, coste: prof + desp };
      }).filter(f => f.visitas > 0);
      totalVisitas = filas.reduce((a, f) => a + f.visitas, 0);
      totalCoste   = filas.reduce((a, f) => a + f.coste,   0);
    }
    if (!isObra && fOf) {
      filas = fOf.map(f => {
        const nd = parseFloat(f.dias)   || 0;
        const h  = parseFloat(f.tiempo) || 0;
        const coste = nd * h * (ch || 0);
        return { nombre: f.nombre, dias: nd, tiempo: h, coste };
      }).filter(f => f.dias > 0);
      totalDias  = filas.reduce((a, f) => a + f.dias,  0);
      totalCoste = filas.reduce((a, f) => a + f.coste, 0);
    }

    return (
      <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>
          <div style={{ background: C.surf, border: `2px solid ${summAccent}44`, borderRadius: 16, padding: "32px 36px", boxShadow: "0 12px 48px #00000070" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 32 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 11, color: summAccent, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Resumen</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: C.text }}>{tituloBloque}</h2>
              </div>
            </div>

            {/* Totales destacados */}
            <div style={{ display: "grid", gridTemplateColumns: isObra ? "1fr 1fr" : "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <div style={{ background: summAccent + "14", border: `1px solid ${summAccent}33`, borderRadius: 10, padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6 }}>
                  {isObra ? "Total visitas" : "Total días"}
                </div>
                <div style={{ fontFamily: C.mono, color: summAccent, fontSize: 32, fontWeight: 800 }}>
                  {isObra ? totalVisitas : totalDias}
                </div>
              </div>
              <div style={{ background: C.accent + "14", border: `1px solid ${C.accent}33`, borderRadius: 10, padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6 }}>Coste estimado</div>
                <div style={{ fontFamily: C.mono, color: C.accent, fontSize: 24, fontWeight: 800 }}>{fmt(totalCoste)} €</div>
              </div>
            </div>

            {/* Detalle por fila */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Detalle por fase</div>
              {filas.map((f, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                  <span style={{ color: "#9aa0c0", flex: 1 }}>{f.nombre}</span>
                  <span style={{ fontFamily: C.mono, color: summAccent, marginLeft: 12, minWidth: 60, textAlign: "right" }}>
                    {isObra ? `${f.visitas} vis.` : `${f.dias} días`}
                  </span>
                  <span style={{ fontFamily: C.mono, color: C.text, marginLeft: 12, minWidth: 80, textAlign: "right" }}>
                    {fmt(f.coste)} €
                  </span>
                </div>
              ))}
              {filas.length === 0 && (
                <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Sin {isObra ? "visitas" : "días"} introducidos.</div>
              )}
            </div>

            <button onClick={advance}
              style={{ width: "100%", background: summAccent, border: "none", borderRadius: 10, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Continuar →
            </button>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#232d40" }}>
              <kbd style={{ background: "#151e2e", border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 5px", fontSize: 10, color: "#2a3a50" }}>Enter</kbd> para continuar
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}>
      {/* Progress */}
      <div style={{ width: "100%", maxWidth: 540, marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontSize: 11, color: C.muted, fontFamily: C.mono }}>{title}</span>
          <span style={{ fontSize: 11, color: C.muted, fontFamily: C.mono }}>{idx + 1} / {fields.length}</span>
        </div>
        <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
          <div style={{ height: "100%", width: pct + "%", background: accent, borderRadius: 2, transition: "width 0.3s ease" }} />
        </div>
        <div style={{ marginTop: 7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: accent, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>{section}</span>
          {total > 0 && <span style={{ fontSize: 13, fontFamily: C.mono, color: C.accent, fontWeight: 700 }}>{fmt(total)} €</span>}
        </div>
      </div>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 540, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: "34px 38px", boxShadow: "0 12px 48px #00000070" }}>
        {cur.optional && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#161e2e", border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 12px", fontSize: 10, color: C.muted, fontFamily: C.mono, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span style={{ opacity: 0.5 }}>○</span> opcional — puedes poner 0 o saltar
          </div>
        )}
        <div style={{ fontSize: cur.label.length > 45 ? 18 : 22, fontWeight: 700, lineHeight: 1.3, marginBottom: 6, letterSpacing: "-0.02em" }}>
          {cur.label}
        </div>
        {cur.sublabel && <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{cur.sublabel}</div>}
        {cur.hint && (
          <div style={{ background: "#0f1828", borderLeft: `3px solid ${accent}`, borderRadius: "0 6px 6px 0", padding: "8px 12px", fontSize: 12, color: C.muted, marginBottom: 16 }}>
            💡 {cur.hint}
          </div>
        )}

        <div style={{ position: "relative", marginBottom: 6 }}>
          <input
            ref={ref}
            type={cur.isText ? "text" : "number"}
            value={val}
            placeholder={cur.isText ? "Escribe aquí…" : "0"}
            step="1"
            onChange={e => setVal(e.target.value)}
            onKeyDown={onKey}
            style={{ width: "100%", background: "#0a1220", border: `2px solid ${accent}55`, borderRadius: 9, padding: cur.suffix ? "13px 72px 13px 14px" : "13px 14px", fontSize: cur.isText ? 18 : 28, fontFamily: cur.isText ? C.sans : C.mono, color: C.text, outline: "none", transition: "border-color 0.15s" }}
            onFocus={e => { e.target.style.borderColor = accent; }}
            onBlur={e => { e.target.style.borderColor = accent + "55"; }}
          />
          {cur.suffix && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.muted, fontFamily: C.mono }}>{cur.suffix}</span>}
        </div>

        {/* Calculated info (e.g. travel time) */}
        {extra && (
          <div style={{ background: accent + "18", border: `1px solid ${accent}33`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: accent, marginBottom: 4, fontFamily: C.mono }}>
            {extra}
          </div>
        )}

        {err && <div style={{ fontSize: 12, color: "#e05050", fontFamily: C.mono, marginBottom: 4 }}>{err}</div>}

        <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
          <button onClick={advance} style={{ flex: 1, background: accent, border: "none", borderRadius: 9, padding: "13px", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            {idx + 1 === fields.length ? "Continuar →" : "Siguiente →"}
          </button>
          {cur.optional && (
            <button onClick={skip} style={{ padding: "13px 16px", background: "none", border: `1px solid ${C.border}`, borderRadius: 9, color: C.muted, fontSize: 13, cursor: "pointer" }}>Saltar</button>
          )}
          {idx > 0 && (
            <button onClick={back} style={{ padding: "13px 14px", background: "none", border: `1px solid ${C.border}`, borderRadius: 9, color: C.muted, fontSize: 13, cursor: "pointer" }}>←</button>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "#232d40" }}>
          <kbd style={{ background: "#151e2e", border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 5px", fontSize: 10, color: "#2a3a50" }}>Enter</kbd> para avanzar
        </div>
      </div>
    </div>
  );
}

// ─── Resumen final ────────────────────────────────────────────────────────────
function generarPDF(obra, res, vis, otros, ch, ck, pct, pem, precioFinal, numOferta) {
  const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const fmtE = (n) => Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const fmtN = (n) => Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Cabecera de sección (colspan 4)
  const seccion4 = (titulo, color) => `
    <tr>
      <td colspan="4" style="background:${color}18; color:${color}; font-family:monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.1em; padding:8px 14px; font-weight:700; border-top:2px solid ${color}44;">
        ${titulo}
      </td>
    </tr>`;

  // Cabecera de sección (colspan 2) para visados/otros
  const seccion2 = (titulo, color) => `
    <tr>
      <td colspan="2" style="background:${color}18; color:${color}; font-family:monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.1em; padding:8px 14px; font-weight:700; border-top:2px solid ${color}44;">
        ${titulo}
      </td>
    </tr>`;

  // Fila de cabecera de columnas
  const cabeceraObra = `
    <tr style="background:#f5f5f5;">
      <td style="padding:5px 14px; font-size:10px; color:#888; font-family:monospace; text-transform:uppercase; letter-spacing:0.07em; border-bottom:1px solid #ddd; width:50%">Fase</td>
      <td style="padding:5px 14px; font-size:10px; color:#888; font-family:monospace; text-transform:uppercase; letter-spacing:0.07em; border-bottom:1px solid #ddd; text-align:center;">Visitas</td>
      <td style="padding:5px 14px; font-size:10px; color:#888; font-family:monospace; text-transform:uppercase; letter-spacing:0.07em; border-bottom:1px solid #ddd; text-align:center;">h/visita</td>
      <td style="padding:5px 14px; font-size:10px; color:#888; font-family:monospace; text-transform:uppercase; letter-spacing:0.07em; border-bottom:1px solid #ddd; text-align:right;">Coste</td>
    </tr>`;

  const cabeceraOf = `
    <tr style="background:#f5f5f5;">
      <td style="padding:5px 14px; font-size:10px; color:#888; font-family:monospace; text-transform:uppercase; letter-spacing:0.07em; border-bottom:1px solid #ddd; width:50%">Tarea</td>
      <td style="padding:5px 14px; font-size:10px; color:#888; font-family:monospace; text-transform:uppercase; letter-spacing:0.07em; border-bottom:1px solid #ddd; text-align:center;">Días</td>
      <td style="padding:5px 14px; font-size:10px; color:#888; font-family:monospace; text-transform:uppercase; letter-spacing:0.07em; border-bottom:1px solid #ddd; text-align:center;">h/día</td>
      <td style="padding:5px 14px; font-size:10px; color:#888; font-family:monospace; text-transform:uppercase; letter-spacing:0.07em; border-bottom:1px solid #ddd; text-align:right;">Coste</td>
    </tr>`;

  // Fila de datos con 4 columnas
  const fila4 = (nombre, col2, col3, coste) => `
    <tr>
      <td style="padding:5px 14px; font-size:12px; color:#333; border-bottom:1px solid #f0f0f0;">${nombre}</td>
      <td style="padding:5px 14px; font-size:12px; color:#555; border-bottom:1px solid #f0f0f0; text-align:center; font-family:monospace;">${col2}</td>
      <td style="padding:5px 14px; font-size:12px; color:#555; border-bottom:1px solid #f0f0f0; text-align:center; font-family:monospace;">${col3}</td>
      <td style="padding:5px 14px; font-size:12px; color:#111; border-bottom:1px solid #f0f0f0; text-align:right; font-family:monospace;">${coste}</td>
    </tr>`;

  // Fila simple 2 columnas para visados/otros
  const fila2 = (label, valor) => `
    <tr>
      <td style="padding:6px 14px; font-size:12px; color:#333; border-bottom:1px solid #f0f0f0; width:65%">${label}</td>
      <td style="padding:6px 14px; font-size:12px; color:#111; text-align:right; border-bottom:1px solid #f0f0f0; font-family:monospace;">${valor}</td>
    </tr>`;

  // Fila de subtotal (colspan 3 + importe)
  const subtotal4 = (label, importe) => `
    <tr>
      <td colspan="3" style="padding:7px 14px; font-size:12px; font-weight:700; background:#f0f4ff; border-top:2px solid #ddd; color:#555; text-align:right; font-family:monospace;">${label}</td>
      <td style="padding:7px 14px; font-size:12px; font-weight:700; background:#f0f4ff; border-top:2px solid #ddd; text-align:right; font-family:monospace; color:#4f7eff;">${importe}</td>
    </tr>`;

  const subtotal2 = (label, importe) => `
    <tr>
      <td style="padding:7px 14px; font-size:12px; font-weight:700; background:#f0f4ff; border-top:2px solid #ddd; color:#555; text-align:right; font-family:monospace;">${label}</td>
      <td style="padding:7px 14px; font-size:12px; font-weight:700; background:#f0f4ff; border-top:2px solid #ddd; text-align:right; font-family:monospace; color:#4f7eff;">${importe}</td>
    </tr>`;

  // Generar filas obra (visitas + tiempo/visita + coste)
  const filasObra = res.filaObra.filter(f => f.total > 0.01).map(f => {
    const vis2 = parseFloat(f.visitas) || 0;
    const tVisita = parseFloat(f.tiempo) || 0;
    return fila4(f.nombre, vis2, fmtN(tVisita) + " h", fmtE(f.total));
  }).join("");

  // Generar filas oficina (días + tiempo/día + coste)
  const filasOf = res.filaOf.filter(f => f.total > 0.01).map(f => {
    const dias = parseFloat(f.dias) || 0;
    const tDia = parseFloat(f.tiempo) || 0;
    return fila4(f.nombre, dias, fmtN(tDia) + " h", fmtE(f.total));
  }).join("");

  const filaVis    = vis.filter(v => (parseFloat(v.coste) || 0) > 0).map(v =>
    fila2(v.concepto, fmtE(parseFloat(v.coste)))
  ).join("");

  const filaOtros = otros.filter(g => (parseFloat(g.uds)||0)*(parseFloat(g.precio)||0) > 0).map(g =>
    fila2(`${g.concepto} (${g.uds} ud. × ${g.precio} €)`, fmtE((parseFloat(g.uds)||0)*(parseFloat(g.precio)||0)))
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Honorarios — ${obra.promotor || "Encargo"}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; padding: 40px 48px; font-size: 13px; }
    h1 { font-size: 22px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.03em; margin-bottom: 4px; }
    .subtitle { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 32px; font-family: monospace; }
    .datos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 32px; margin-bottom: 28px; }
    .dato { border-bottom: 1px solid #eee; padding-bottom: 8px; }
    .dato-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; font-family: monospace; margin-bottom: 3px; }
    .dato-val { font-size: 14px; font-weight: 600; color: #111; }
    .total-box { background: #f0f4ff; border: 2px solid #4f7eff44; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center; }
    .total-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.1em; font-family: monospace; }
    .total-val { font-size: 32px; font-weight: 800; color: #4f7eff; font-family: monospace; }
    .pct-box { text-align: right; }
    .pct-val { font-size: 22px; font-weight: 800; color: #7c4fff; font-family: monospace; }
    .pct-label { font-size: 11px; color: #888; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .subtotal-row td { padding: 7px 14px; font-size: 12px; font-weight: 700; background: #f8f8f8; border-top: 1px solid #ddd; text-align: right; font-family: monospace; }
    .subtotal-row td:first-child { text-align: left; color: #555; }
    .params { font-size: 11px; color: #888; font-family: monospace; margin-top: 24px; padding-top: 14px; border-top: 1px solid #eee; display: flex; gap: 24px; }
    .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #eee; font-size: 10px; color: #aaa; text-align: center; }
    @media print { body { padding: 20px 28px; } }
  </style>
</head>
<body>

  <h1>Cálculo de Honorarios Profesionales${numOferta ? ` — Oferta ${numOferta}` : ""}</h1>
  <div class="subtitle">Arquitecto Técnico · Dirección de Ejecución de Obra · Coordinación S&amp;S · ${fecha}</div>

  <!-- Datos del encargo -->
  <div class="datos-grid">
    <div class="dato">
      <div class="dato-label">Promotor / cliente</div>
      <div class="dato-val">${obra.promotor || "—"}</div>
    </div>
    <div class="dato">
      <div class="dato-label">Ubicación de la obra</div>
      <div class="dato-val">${obra.ubicacion || "—"}</div>
    </div>
    <div class="dato">
      <div class="dato-label">Superficie construida</div>
      <div class="dato-val">${obra.superficie ? obra.superficie + " m²" : "—"}</div>
    </div>
    <div class="dato">
      <div class="dato-label">PEM</div>
      <div class="dato-val">${pem > 0 ? fmtE(pem) : "—"}</div>
    </div>
  </div>

  <!-- Totales: calculado + propuesto siempre juntos -->
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px;">

    <!-- Total honorarios calculado -->
    <div style="background:#f0f4ff; border:2px solid #4f7eff44; border-radius:10px; padding:18px 20px;">
      <div style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.1em; font-family:monospace; margin-bottom:6px;">Total honorarios del encargo</div>
      <div style="font-size:28px; font-weight:800; color:#4f7eff; font-family:monospace; line-height:1;">${fmtE(res.total)}</div>
      ${pct > 0 ? `<div style="font-size:11px; color:#888; margin-top:6px; font-family:monospace;">
        <span style="color:#7c4fff; font-weight:700;">${Number(pct).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span> sobre PEM
      </div>` : ""}
    </div>

    <!-- Precio propuesto al cliente -->
    <div style="background:#fffbea; border:2px solid #c4901055; border-radius:10px; padding:18px 20px;">
      <div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:0.1em; font-family:monospace; margin-bottom:6px;">Precio propuesto al cliente</div>
      <div style="font-size:28px; font-weight:800; color:#b07800; font-family:monospace; line-height:1;">${fmtE(precioFinal ?? res.total)}</div>
      ${pem > 0 ? `<div style="font-size:11px; color:#888; margin-top:6px; font-family:monospace;">
        <span style="color:#b07800; font-weight:700;">${Number((precioFinal ?? res.total) / pem * 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span> sobre PEM
      </div>` : ""}
      ${precioFinal != null && Math.abs(precioFinal - res.total) > 0.01 ? `
      <div style="font-size:11px; margin-top:5px; color:${precioFinal < res.total ? '#cc3333' : '#228822'}; font-family:monospace;">
        ${precioFinal < res.total ? '▼' : '▲'} ${precioFinal < res.total ? '-' : '+'}${fmtE(Math.abs(precioFinal - res.total))}
        (${Number(Math.abs((precioFinal - res.total) / res.total) * 100).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% respecto al calculado)
      </div>` : `<div style="font-size:11px; margin-top:5px; color:#228822; font-family:monospace;">✓ Coincide con el honorario calculado</div>`}
    </div>

  </div>

  <!-- Trabajo a Pie de Obra (4 columnas) -->
  <table>
    ${seccion4("Trabajo a Pie de Obra", "#4f7eff")}
    ${cabeceraObra}
    ${filasObra || `<tr><td colspan="4" style="padding:6px 14px;font-size:12px;color:#aaa;font-style:italic;">Sin visitas introducidas</td></tr>`}
    ${subtotal4("Subtotal trabajo en obra", fmtE(res.tObra))}
  </table>

  <!-- Trabajo de Oficina Técnica (4 columnas) -->
  <table style="margin-top:8px">
    ${seccion4("Trabajo de Oficina Técnica y Gestiones", "#a78bfa")}
    ${cabeceraOf}
    ${filasOf || `<tr><td colspan="4" style="padding:6px 14px;font-size:12px;color:#aaa;font-style:italic;">Sin días introducidos</td></tr>`}
    ${subtotal4("Subtotal oficina técnica", fmtE(res.tOf))}
  </table>

  <!-- Visados (2 columnas) -->
  <table style="margin-top:8px">
    ${seccion2("Gastos de Visado y Registro", "#e040a0")}
    ${filaVis || `<tr><td colspan="2" style="padding:6px 14px;font-size:12px;color:#aaa;font-style:italic;">Sin gastos de visado</td></tr>`}
    ${subtotal2("Subtotal visados", fmtE(res.tVis))}
  </table>

  <!-- Otros gastos (2 columnas) -->
  <table style="margin-top:8px">
    ${seccion2("Otros Gastos Directos del Encargo", "#c49010")}
    ${filaOtros || `<tr><td colspan="2" style="padding:6px 14px;font-size:12px;color:#aaa;font-style:italic;">Sin otros gastos</td></tr>`}
    ${subtotal2("Subtotal otros gastos", fmtE(res.tOtros))}
  </table>

  <div class="params">
    <span>Coste/hora: <strong>${Number(ch).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h</strong></span>
    <span>Coste/km: <strong>${Number(ck).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/km</strong></span>
    <span>Distancia: <strong>${obra.distancia || "—"} km</strong></span>
    ${obra.distancia && obra.velocidad ? `<span>Tiempo despl.: <strong>${Math.round((parseFloat(obra.distancia) / parseFloat(obra.velocidad)) * 60)} min</strong></span>` : ""}
  </div>

  <div class="footer">
    Documento generado por Cálculo de Honorarios Profesionales · ${fecha}
  </div>

</body>
</html>`;

  // Descarga directa como HTML con cabecera de impresión automática
  // Usamos un div oculto + html2canvas no disponible, así que generamos
  // un documento auto-imprimible que el navegador puede guardar como PDF
  // mediante el diálogo de impresión → "Guardar como PDF"

  // Añadimos script de autoprint al HTML para que al abrirse se descargue
  const htmlConPrint = html.replace(
    "</body>",
    `<script>
      window.onload = function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      };
    <\/script></body>`
  );

  // Crear enlace de descarga como .html que se abre y autoimprime
  const blob = new Blob([htmlConPrint], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Honorarios_${(obra.promotor || "Encargo").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Resumen({ obra, fO, fOf, vis, otros, ch, ck, precioFinal, numOferta, onNew, onChangeBase, onRevisarPrecio }) {
  const res = calcHonorarios(obra, fO, fOf, vis, otros, ch, ck);
  const pem = parseFloat(obra.pem) || 0;
  const pct = pem > 0 ? (res.total / pem) * 100 : 0;
  const hayPropuesto = precioFinal != null && Math.abs(precioFinal - res.total) > 0.01;
  const pctPropuesto = pem > 0 ? (precioFinal / pem) * 100 : 0;
  const [detalle, setDetalle] = useState(false);

  return (
    <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
      <div style={{ width: "100%", maxWidth: 580 }}>

        {/* ── Cabecera encargo ── */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {numOferta && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.accent + "18", border: `1px solid ${C.accent}33`, borderRadius: 20, padding: "4px 14px", marginBottom: 10, fontFamily: C.mono, fontSize: 12, color: C.accent, fontWeight: 700 }}>
              📋 Oferta {numOferta}
            </div>
          )}
          {(obra.promotor || obra.ubicacion) && (
            <div style={{ fontSize: 12, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {obra.promotor}{obra.ubicacion ? ` · ${obra.ubicacion}` : ""}
            </div>
          )}
        </div>

        {/* ── Cifra principal ── */}
        <div style={{ background: C.surf, border: `2px solid ${C.accent}55`, borderRadius: 20, padding: "36px 32px 28px", textAlign: "center", marginBottom: 16, position: "relative", overflow: "hidden" }}>
          {/* Glow decorativo */}
          <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 300, height: 160, background: `radial-gradient(ellipse, ${C.accent}22 0%, transparent 70%)`, pointerEvents: "none" }} />

          <div style={{ fontSize: 11, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>
            Total honorarios del encargo
          </div>
          <div style={{ fontSize: 64, fontFamily: C.mono, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, background: `linear-gradient(135deg, ${C.accent}, #a78bfa)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 10 }}>
            {fmt(res.total)} €
          </div>

          {pct > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.accent + "18", border: `1px solid ${C.accent}33`, borderRadius: 20, padding: "6px 16px", marginBottom: 20 }}>
              <span style={{ fontSize: 13, color: C.accent, fontFamily: C.mono, fontWeight: 700 }}>{fmt(pct)}%</span>
              <span style={{ fontSize: 12, color: C.muted }}>sobre PEM</span>
              <span style={{ fontSize: 12, color: C.muted }}>·</span>
              <span style={{ fontSize: 12, color: C.muted }}>PEM: <span style={{ color: C.text, fontFamily: C.mono }}>{fmt(pem)} €</span></span>
            </div>
          )}

          {/* Mensaje explicativo */}
          <div style={{ background: "#0a1220", borderRadius: 12, padding: "14px 18px", textAlign: "left" }}>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>
              Este importe corresponde a los <strong>gastos totales previstos</strong> para la dirección y gestión del proyecto, incluyendo el trabajo a pie de obra, la gestión técnica en oficina, los gastos de visado y registro, y todos los gastos directos asociados al encargo.
            </div>
          </div>
        </div>

        {/* ── Precio propuesto (si difiere) ── */}
        {hayPropuesto && (
          <div style={{ background: C.yBg, border: `2px solid ${C.yBorder}`, borderRadius: 16, padding: "22px 28px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: C.yText, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Precio propuesto al cliente</div>
              <div style={{ fontSize: 40, fontFamily: C.mono, fontWeight: 800, color: C.yText, lineHeight: 1 }}>
                {fmt(precioFinal)} €
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                Diferencia respecto al calculado:{" "}
                <span style={{ fontFamily: C.mono, color: precioFinal < res.total ? "#ff7070" : C.gText, fontWeight: 700 }}>
                  {precioFinal < res.total ? "−" : "+"}{fmt(Math.abs(precioFinal - res.total))} €
                  {" "}({Number(Math.abs((precioFinal - res.total) / res.total) * 100).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                </span>
              </div>
            </div>
            {pem > 0 && (
              <div style={{ textAlign: "center", background: C.yText + "18", border: `1px solid ${C.yBorder}`, borderRadius: 10, padding: "12px 20px" }}>
                <div style={{ fontSize: 26, fontFamily: C.mono, color: C.yText, fontWeight: 800 }}>{fmt(pctPropuesto)}%</div>
                <div style={{ fontSize: 10, color: "#8a7030", fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>sobre PEM</div>
              </div>
            )}
          </div>
        )}

        {/* ── Desglose por bloques ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Trabajo en obra",   val: res.tObra,   color: C.accent },
            { label: "Oficina técnica",   val: res.tOf,     color: "#a78bfa" },
            { label: "Visados",           val: res.tVis,    color: C.gText },
            { label: "Otros gastos",      val: res.tOtros,  color: C.yText },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: C.surf, border: `1px solid ${color}33`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6, fontFamily: C.mono, lineHeight: 1.4 }}>{label}</div>
              <div style={{ fontFamily: C.mono, color, fontSize: 15, fontWeight: 700 }}>{fmt(val)} €</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                {res.total > 0 ? fmt((val / res.total) * 100) : "0,00"}%
              </div>
            </div>
          ))}
        </div>

        {/* ── Desglose detallado (colapsable) ── */}
        <button onClick={() => setDetalle(d => !d)}
          style={{ width: "100%", background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px", color: C.muted, fontSize: 12, cursor: "pointer", marginBottom: detalle ? 0 : 16, fontFamily: C.mono }}>
          {detalle ? "▲ Ocultar desglose detallado" : "▼ Ver desglose detallado"}
        </button>

        {detalle && (
          <div style={{ border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", marginBottom: 16, overflow: "hidden" }}>
            {[
              { title: "Trabajo a Pie de Obra", items: res.filaObra, color: C.accent },
              { title: "Trabajo de Oficina Técnica", items: res.filaOf, color: "#a78bfa" },
            ].map(({ title, items, color }) => {
              const visible = items.filter(f => f.total > 0.01);
              if (!visible.length) return null;
              return (
                <div key={title} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ background: color + "12", padding: "8px 14px", fontSize: 10, color, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</div>
                  {visible.map((f, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 12, background: C.surf }}>
                      <span style={{ color: "#9aa0c0" }}>{f.nombre}</span>
                      <span style={{ fontFamily: C.mono, color: C.text }}>{fmt(f.total)} €</span>
                    </div>
                  ))}
                </div>
              );
            })}
            {/* Visados */}
            {res.tVis > 0 && (
              <div style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ background: "#f472b612", padding: "8px 14px", fontSize: 10, color: "#f472b6", fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Visados y Registro</div>
                {vis.filter(v => (parseFloat(v.coste) || 0) > 0).map((v, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 12, background: C.surf }}>
                    <span style={{ color: "#9aa0c0" }}>{v.concepto}</span>
                    <span style={{ fontFamily: C.mono, color: C.text }}>{fmt(parseFloat(v.coste))} €</span>
                  </div>
                ))}
              </div>
            )}
            {/* Otros */}
            {res.tOtros > 0 && (
              <div>
                <div style={{ background: C.yText + "12", padding: "8px 14px", fontSize: 10, color: C.yText, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Otros Gastos Directos</div>
                {otros.filter(g => (parseFloat(g.uds) || 0) * (parseFloat(g.precio) || 0) > 0).map((g, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 12, background: C.surf }}>
                    <span style={{ color: "#9aa0c0" }}>{g.concepto} ({g.uds} ud.)</span>
                    <span style={{ fontFamily: C.mono, color: C.text }}>{fmt((parseFloat(g.uds) || 0) * (parseFloat(g.precio) || 0))} €</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Parámetros ── */}
        <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", gap: 20, flexWrap: "wrap", fontSize: 11 }}>
          <span style={{ color: C.muted }}>€/h <span style={{ fontFamily: C.mono, color: C.gText, fontWeight: 700 }}>{fmt(ch)}</span></span>
          <span style={{ color: C.muted }}>€/km <span style={{ fontFamily: C.mono, color: C.yText, fontWeight: 700 }}>{fmt(ck)}</span></span>
          <span style={{ color: C.muted }}>Distancia <span style={{ fontFamily: C.mono, color: C.text }}>{obra.distancia || "—"} km</span></span>
          {obra.velocidad && obra.distancia && (
            <span style={{ color: C.muted }}>Tiempo/despl. <span style={{ fontFamily: C.mono, color: C.text }}>{Math.round((parseFloat(obra.distancia) / parseFloat(obra.velocidad)) * 60)} min</span></span>
          )}
        </div>

        {/* ── Acciones ── */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onNew}
            style={{ flex: 1, background: C.accent, border: "none", borderRadius: 10, padding: "13px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", minWidth: 140 }}>
            + Nuevo encargo
          </button>
          <button
            onClick={() => generarPDF(obra, res, vis, otros, ch, ck, pct, pem, precioFinal, numOferta)}
            style={{ flex: 1, background: "#1a2a1a", border: `1px solid ${C.gBorder}`, borderRadius: 10, padding: "13px", color: C.gText, fontSize: 14, fontWeight: 600, cursor: "pointer", minWidth: 140 }}>
            ⬇ Descargar informe
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button onClick={onRevisarPrecio}
            style={{ flex: 1, background: C.yBg, border: `1px solid ${C.yBorder}`, borderRadius: 10, padding: "11px", color: C.yText, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ✎ Modificar precio propuesto
          </button>
          <button onClick={onChangeBase}
            style={{ padding: "11px 18px", background: C.surf, border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 13, cursor: "pointer" }}>
            ⚙ Datos de partida
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Intro Screen ─────────────────────────────────────────────────────────────
function IntroScreen({ step, title, subtitle, accent, icon, items, onStart }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Enter") onStart(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

  return (
    <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ display: "inline-flex", alignItems: "center", background: accent + "18", border: `1px solid ${accent}44`, borderRadius: 20, padding: "5px 14px", marginBottom: 28 }}>
          <span style={{ fontSize: 11, color: accent, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Paso {step}</span>
        </div>
        <div style={{ fontSize: 44, marginBottom: 14 }}>{icon}</div>
        <h1 style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: 16, background: `linear-gradient(130deg, ${accent} 20%, ${C.text} 80%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {title}
        </h1>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.65, marginBottom: 32, maxWidth: 420 }}>{subtitle}</p>
        <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Datos que vamos a pedir</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {items.map((item, i) => (
              <div key={i} style={{ background: accent + "12", border: `1px solid ${accent}30`, borderRadius: 20, padding: "4px 12px", fontSize: 12, color: accent }}>
                {item}
              </div>
            ))}
          </div>
        </div>
        <button onClick={onStart} style={{ width: "100%", background: accent, border: "none", borderRadius: 12, padding: "16px", color: "#fff", fontSize: 17, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}>
          Empezar →
        </button>
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: C.border }}>
          o pulsa <kbd style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 6px", fontSize: 10, color: C.muted }}>Enter</kbd>
        </div>
      </div>
    </div>
  );
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
const STORAGE_KEY = "honorarios_base_v1";

function saveBase(chData, ckData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      chData, ckData, savedAt: new Date().toISOString()
    }));
  } catch (e) {}
}

function loadBase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function monthsAgo(isoDate) {
  const saved = new Date(isoDate);
  const now = new Date();
  return (now.getFullYear() - saved.getFullYear()) * 12 + (now.getMonth() - saved.getMonth());
}

function fmtDate(isoDate) {
  return new Date(isoDate).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Pantalla de bienvenida / revisión ────────────────────────────────────────
function WelcomeBack({ savedAt, chData, ckData, ch, ck, needsReview, onContinue, onReview }) {
  const meses = monthsAgo(savedAt);
  return (
    <div style={{ minHeight: "calc(100vh - 52px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 520 }}>

        {needsReview ? (
          <>
            {/* Alerta revisión */}
            <div style={{ background: "#2a1a00", border: `1px solid ${C.yBorder}`, borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.yText, marginBottom: 8 }}>
                Han pasado {meses} meses desde la última revisión
              </div>
              <div style={{ fontSize: 13, color: "#a08040", lineHeight: 1.65 }}>
                Los datos de <strong style={{ color: C.yText }}>Coste/Hora</strong> y <strong style={{ color: C.yText }}>Coste/Km</strong> se introdujeron el <strong style={{ color: C.text }}>{fmtDate(savedAt)}</strong>. Se recomienda revisarlos al menos una vez al año o cuando haya cambios significativos en tus costes.
              </div>
            </div>
            <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", gap: 24 }}>
              <div><div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Coste/hora actual</div>
                <div style={{ fontFamily: C.mono, color: C.gText, fontSize: 20, fontWeight: 700 }}>{fmt(ch)} €/h</div></div>
              <div><div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Coste/km actual</div>
                <div style={{ fontFamily: C.mono, color: C.yText, fontSize: 20, fontWeight: 700 }}>{fmt(ck)} €/km</div></div>
            </div>
            <button onClick={onReview} style={{ width: "100%", background: C.yBorder, border: "none", borderRadius: 11, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
              ✏️  Revisar y actualizar datos de partida
            </button>
            <button onClick={onContinue} style={{ width: "100%", background: C.surf, border: `1px solid ${C.border}`, borderRadius: 11, padding: "13px", color: C.muted, fontSize: 14, cursor: "pointer" }}>
              Continuar con los datos actuales
            </button>
          </>
        ) : (
          <>
            {/* Bienvenida normal */}
            <div style={{ fontSize: 36, marginBottom: 16 }}>👋</div>
            <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 12, background: `linear-gradient(130deg, ${C.accent} 20%, ${C.text} 80%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Bienvenido de nuevo
            </h1>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65, marginBottom: 24 }}>
              Tus datos de coste están guardados desde el <strong style={{ color: C.text }}>{fmtDate(savedAt)}</strong>. Puedes calcular honorarios directamente o revisar tus datos de partida si ha habido cambios.
            </p>
            <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 24 }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Datos de partida guardados</div>
              <div style={{ display: "flex", gap: 28 }}>
                <div><div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Coste/hora</div>
                  <div style={{ fontFamily: C.mono, color: C.gText, fontSize: 22, fontWeight: 700 }}>{fmt(ch)} €/h</div></div>
                <div><div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Coste/km</div>
                  <div style={{ fontFamily: C.mono, color: C.yText, fontSize: 22, fontWeight: 700 }}>{fmt(ck)} €/km</div></div>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: C.muted, fontFamily: C.mono }}>
                📅 Próxima revisión recomendada: <span style={{ color: C.text }}>{fmtDate(new Date(new Date(savedAt).setMonth(new Date(savedAt).getMonth() + 12)).toISOString())}</span>
              </div>
            </div>
            <button onClick={onContinue} style={{ width: "100%", background: C.accent, border: "none", borderRadius: 11, padding: "15px", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
              Calcular honorarios →
            </button>
            <button onClick={onReview} style={{ width: "100%", background: C.surf, border: `1px solid ${C.border}`, borderRadius: 11, padding: "12px", color: C.muted, fontSize: 13, cursor: "pointer" }}>
              ✏️  Revisar datos de partida
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Historial helpers ────────────────────────────────────────────────────────
const HIST_KEY = "honorarios_historial_v1";

function loadHistorial() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { return []; }
}

function saveHistorial(hist) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(hist)); } catch {}
}

function genNumOferta() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `${yy}${mm}${dd}`;
  const hist = loadHistorial();
  const hoy = hist.filter(h => h.numOferta.startsWith(prefix));
  const nn = String(hoy.length + 1).padStart(2, "0");
  return `${prefix}_${nn}`;
}

function guardarEnHistorial(result, ch, ck) {
  const hist = loadHistorial();
  const numOferta = genNumOferta();
  const res = calcHonorarios(result.obra, result.fO, result.fOf, result.vis, result.otros, ch, ck);
  const entrada = {
    numOferta,
    fecha: new Date().toISOString(),
    promotor: result.obra?.promotor || "—",
    ubicacion: result.obra?.ubicacion || "—",
    pem: parseFloat(result.obra?.pem) || 0,
    total: res.total,
    precioFinal: result.precioFinal ?? res.total,
    ch, ck,
    data: result,
  };
  hist.unshift(entrada); // más reciente primero
  saveHistorial(hist);
  return numOferta;
}

// ─── Pantalla Historial ───────────────────────────────────────────────────────
function Historial({ onClose, onCargar, ch, ck }) {
  const [hist, setHist] = useState(() => loadHistorial());
  const [confirmDel, setConfirmDel] = useState(null);

  const eliminar = (numOferta) => {
    const updated = hist.filter(h => h.numOferta !== numOferta);
    saveHistorial(updated);
    setHist(updated);
    setConfirmDel(null);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 52px)", padding: "32px 24px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>Historial de encargos</h2>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: C.mono }}>{hist.length} encargo{hist.length !== 1 ? "s" : ""} guardado{hist.length !== 1 ? "s" : ""}</div>
        </div>
        <button onClick={onClose} style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 16px", color: C.muted, fontSize: 13, cursor: "pointer" }}>← Volver</button>
      </div>

      {hist.length === 0 ? (
        <div style={{ textAlign: "center", color: C.muted, marginTop: 80, fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
          Todavía no hay encargos guardados.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {hist.map((h) => {
            const fecha = new Date(h.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
            const pct = h.pem > 0 ? (h.precioFinal / h.pem) * 100 : 0;
            const hayDif = Math.abs(h.precioFinal - h.total) > 0.01;
            return (
              <div key={h.numOferta} style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                {/* Número oferta */}
                <div style={{ minWidth: 100 }}>
                  <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Nº oferta</div>
                  <div style={{ fontFamily: C.mono, color: C.accent, fontSize: 14, fontWeight: 700 }}>{h.numOferta}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{fecha}</div>
                </div>
                {/* Datos encargo */}
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{h.promotor}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{h.ubicacion}</div>
                </div>
                {/* Importes */}
                <div style={{ textAlign: "right", minWidth: 130 }}>
                  {hayDif ? (
                    <>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", marginBottom: 2 }}>Precio propuesto</div>
                      <div style={{ fontFamily: C.mono, color: C.yText, fontSize: 16, fontWeight: 700 }}>{fmt(h.precioFinal)} €</div>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono }}>Calculado: {fmt(h.total)} €</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, textTransform: "uppercase", marginBottom: 2 }}>Total honorarios</div>
                      <div style={{ fontFamily: C.mono, color: C.accent, fontSize: 16, fontWeight: 700 }}>{fmt(h.total)} €</div>
                    </>
                  )}
                  {pct > 0 && <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: C.mono }}>{fmt(pct)}% PEM</div>}
                </div>
                {/* Acciones */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button onClick={() => onCargar(h)} style={{ background: C.accent + "22", border: `1px solid ${C.accent}44`, borderRadius: 7, padding: "6px 14px", color: C.accent, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    Ver / Cargar
                  </button>
                  {confirmDel === h.numOferta ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => eliminar(h.numOferta)} style={{ flex: 1, background: "#3a1010", border: "1px solid #882222", borderRadius: 7, padding: "5px 8px", color: "#ff7070", fontSize: 11, cursor: "pointer" }}>Sí, borrar</button>
                      <button onClick={() => setConfirmDel(null)} style={{ flex: 1, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 8px", color: C.muted, fontSize: 11, cursor: "pointer" }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(h.numOferta)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 14px", color: C.muted, fontSize: 12, cursor: "pointer" }}>
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  // Load saved base data on mount
  const saved = loadBase();
  const hasSaved = saved && calcCosteHora(saved.chData).costeHora > 0 && calcCosteKm(saved.ckData).costeKm > 0;
  const needsReview = hasSaved && monthsAgo(saved.savedAt) >= 12;

  const initScreen = hasSaved ? "welcome" : "ch_intro";

  const [screen, setScreen] = useState(initScreen);
  const [chData, setChData] = useState(hasSaved ? saved.chData : mkCH());
  const [ckData, setCkData] = useState(hasSaved ? saved.ckData : mkCK());
  const [result, setResult] = useState(null);
  const [numOfertaActual, setNumOfertaActual] = useState(null);
  const [menu, setMenu] = useState(false);

  const chRes = calcCosteHora(chData);
  const ckRes = calcCosteKm(ckData);
  const ch = chRes.costeHora;
  const ck = ckRes.costeKm;
  const chOk = ch > 0, ckOk = ck > 0;

  // Save to localStorage whenever base data changes and both are valid
  useEffect(() => {
    if (chOk && ckOk) saveBase(chData, ckData);
  }, [chData, ckData]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { opacity: 0.2; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        button { transition: opacity 0.12s; } button:hover { opacity: 0.82; }
      `}</style>

      {/* Nav */}
      <div style={{ height: 52, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky", top: 0, background: C.bg, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="36" height="36" style={{ borderRadius: 8, flexShrink: 0 }}>
            <defs>
              <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor:"#0a1628"}}/>
                <stop offset="100%" style={{stopColor:"#0d2142"}}/>
              </linearGradient>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor:"#f5c842"}}/>
                <stop offset="100%" style={{stopColor:"#e8a020"}}/>
              </linearGradient>
              <linearGradient id="goldVert" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor:"#fdd835"}}/>
                <stop offset="100%" style={{stopColor:"#e8a020"}}/>
              </linearGradient>
              <linearGradient id="bar1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor:"#60a5fa"}}/>
                <stop offset="100%" style={{stopColor:"#2563eb"}}/>
              </linearGradient>
              <linearGradient id="bar2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor:"#fdd835"}}/>
                <stop offset="100%" style={{stopColor:"#d97706"}}/>
              </linearGradient>
              <linearGradient id="bar3" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor:"#34d399"}}/>
                <stop offset="100%" style={{stopColor:"#059669"}}/>
              </linearGradient>
              <filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000" floodOpacity="0.35"/></filter>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="cascoGlow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e3a5f" strokeWidth="0.5" opacity="0.5"/>
              </pattern>
            </defs>
            <rect width="400" height="400" fill="url(#bgGrad)" rx="28"/>
            <rect width="400" height="400" fill="url(#grid)" rx="28" opacity="0.45"/>
            <polygon points="200,28 345,112 345,278 200,362 55,278 55,112" fill="none" stroke="#1e3a5f" strokeWidth="1.5" opacity="0.6"/>
            <g transform="translate(200, 118)" filter="url(#cascoGlow)">
              <path d="M -62,18 Q -65,-48 0,-58 Q 65,-48 62,18 Z" fill="url(#goldVert)"/>
              <path d="M -62,18 Q -78,20 -80,28 L -10,28 L -10,18 Z" fill="url(#goldVert)"/>
              <path d="M 62,18 Q 78,20 80,28 L 10,28 L 10,18 Z" fill="url(#goldVert)"/>
              <rect x="-80" y="28" width="160" height="12" rx="6" fill="#e8a020"/>
              <rect x="-5" y="-50" width="10" height="55" rx="5" fill="#e8a020" opacity="0.4"/>
            </g>
            <rect x="95" y="288" width="210" height="4" rx="2" fill="url(#goldGrad)" opacity="0.85"/>
            <rect x="112" y="200" width="42" height="88" rx="6" fill="url(#bar1)" filter="url(#shadow)"/>
            <rect x="179" y="224" width="42" height="64" rx="6" fill="url(#bar2)" filter="url(#shadow)"/>
            <rect x="246" y="244" width="42" height="44" rx="6" fill="url(#bar3)" filter="url(#shadow)"/>
            <polyline points="133,192 200,216 267,235" fill="none" stroke="#f5c842" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)"/>
            <circle cx="133" cy="192" r="5" fill="#f5c842" filter="url(#glow)"/>
            <circle cx="200" cy="216" r="5" fill="#f5c842" filter="url(#glow)"/>
            <circle cx="267" cy="235" r="5" fill="#f5c842" filter="url(#glow)"/>
            <text x="200" y="326" textAnchor="middle" fontFamily="'Trebuchet MS', sans-serif" fontSize="17" fontWeight="600" letterSpacing="4" fill="white" opacity="0.9">CÁLCULO DE</text>
            <text x="200" y="356" textAnchor="middle" fontFamily="'Trebuchet MS', sans-serif" fontSize="21" fontWeight="900" letterSpacing="5" fill="url(#goldGrad)" filter="url(#glow)">HONORARIOS</text>
            <line x1="130" y1="368" x2="270" y2="368" stroke="url(#goldGrad)" strokeWidth="1" opacity="0.5"/>
            <ellipse cx="200" cy="14" rx="55" ry="5" fill="white" opacity="0.04"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em" }}>Cálculo de Honorarios Profesionales</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {chOk && <span style={{ fontSize: 11, color: C.muted }}>€/h <span style={{ fontFamily: C.mono, color: C.gText, fontWeight: 700 }}>{fmt(ch)}</span></span>}
          {ckOk && <span style={{ fontSize: 11, color: C.muted }}>€/km <span style={{ fontFamily: C.mono, color: C.yText, fontWeight: 700 }}>{fmt(ck)}</span></span>}
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenu(m => !m)} style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 12px", color: C.muted, fontSize: 12, cursor: "pointer" }}>⚙ Menú</button>
            {menu && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 48 }} onClick={() => setMenu(false)} />
                <div style={{ position: "absolute", right: 0, top: 34, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 10, minWidth: 220, boxShadow: "0 8px 32px #00000090", zIndex: 49 }}>
                  {[
                    { label: "✏️  Revisar Coste/Hora", action: () => { setScreen("ch_intro"); setMenu(false); } },
                    { label: "✏️  Revisar Coste/Km",  action: () => { setScreen("ck_intro"); setMenu(false); } },
                    { label: "📋  Nuevo encargo",      action: () => { setScreen("h");        setMenu(false); }, off: !chOk || !ckOk },
                    { label: "📊  Ver último resultado", action: () => { setScreen("res");    setMenu(false); }, off: !result },
                    { label: "🗂  Historial de encargos", action: () => { setScreen("historial"); setMenu(false); } },
                  ].map(({ label, action, off }) => (
                    <button key={label} onClick={off ? undefined : action}
                      style={{ display: "block", width: "100%", background: "none", border: "none", padding: "11px 16px", color: off ? C.border : C.text, fontSize: 13, textAlign: "left", cursor: off ? "default" : "pointer", borderBottom: `1px solid ${C.border}` }}>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Screens */}
      {screen === "welcome" && (
        <WelcomeBack
          savedAt={saved.savedAt}
          chData={chData} ckData={ckData}
          ch={ch} ck={ck}
          needsReview={needsReview}
          onContinue={() => setScreen("h")}
          onReview={() => setScreen("ch_intro")}
        />
      )}
      {screen === "ch_intro" && (
        <IntroScreen
          step="1 / 3"
          title="Cálculo Precio Hora"
          subtitle="Vamos a calcular cuánto te cuesta cada hora efectiva de trabajo. Estos datos se guardarán automáticamente y se te pedirá que los revises una vez al año o cuando tus costes cambien significativamente."
          accent={C.gText}
          icon="⏱"
          items={["Previsión social y seguros", "Fiscalidad", "Software y local", "Equipos y consumibles", "Salario neto", "Horas de trabajo"]}
          onStart={() => setScreen("ch")}
        />
      )}
      {screen === "ch" && (
        <Wizard steps={CH_STEPS} data={chData} setData={setChData}
          onComplete={(d) => { setChData(d); setScreen("ck_intro"); }}
          title="Cálculo Precio Hora" accent={C.gText} />
      )}
      {screen === "ck_intro" && (
        <IntroScreen
          step="2 / 3"
          title="Cálculo Precio Km"
          subtitle="Ahora calcularemos el coste real de cada kilómetro recorrido. Estos datos también se guardarán y se revisarán anualmente junto con el Coste/Hora."
          accent={C.yText}
          icon="🚗"
          items={["Datos del vehículo", "Mantenimiento y neumáticos", "Seguro e impuestos", "Combustible", "Ajuste de km no efectivos"]}
          onStart={() => setScreen("ck")}
        />
      )}
      {screen === "ck" && (
        <Wizard steps={CK_STEPS} data={ckData} setData={setCkData}
          onComplete={(d) => { setCkData(d); setScreen("h"); }}
          title="Cálculo Precio Km" accent={C.yText} />
      )}
      {screen === "h" && chOk && ckOk && (
        <HWizard ch={ch} ck={ck}
          onComplete={(data) => {
            const num = guardarEnHistorial(data, ch, ck);
            setNumOfertaActual(num);
            setResult(data);
            setScreen("res");
          }} />
      )}
      {screen === "revisar_precio" && result && (
        <RevisionPrecio
          total={(() => { const chR = calcCosteHora(chData); const ckR = calcCosteKm(ckData); return calcHonorarios(result.obra, result.fO, result.fOf, result.vis, result.otros, chR.costeHora, ckR.costeKm).total; })()}
          pem={parseFloat(result.obra?.pem) || 0}
          onConfirm={(precioFinal) => {
            const updated = { ...result, precioFinal };
            // Update in historial
            const hist = loadHistorial();
            const idx = hist.findIndex(h => h.numOferta === numOfertaActual);
            if (idx >= 0) { hist[idx].precioFinal = precioFinal; saveHistorial(hist); }
            setResult(updated);
            setScreen("res");
          }}
        />
      )}
      {screen === "res" && result && (
        <Resumen {...result} ch={ch} ck={ck}
          numOferta={numOfertaActual}
          onNew={() => setScreen("h")}
          onChangeBase={() => setScreen("ch_intro")}
          onRevisarPrecio={() => setScreen("revisar_precio")} />
      )}
      {screen === "historial" && (
        <Historial
          onClose={() => setScreen(result ? "res" : (chOk && ckOk ? "h" : "ch_intro"))}
          onCargar={(h) => {
            setResult(h.data);
            setNumOfertaActual(h.numOferta);
            setScreen("res");
          }}
          ch={ch} ck={ck}
        />
      )}
    </div>
  );
}
