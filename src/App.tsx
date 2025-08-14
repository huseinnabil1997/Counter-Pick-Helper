import { useMemo, useState, useEffect } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  Typography,
  TextField,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Box,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  Checkbox,
} from "@mui/material";
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  Code as CodeIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Search as SearchIcon
} from "@mui/icons-material";

// Counter Pick Helper
// Single-file React app with Material-UI styling
// Features:
// - Type enemy heroes (comma-separated) → get recommended counter picks.
// - Import rules via Text ("Enemy - OurHero1, OurHero2") or JSON (object/array forms).
// - Export current rules as JSON.
// - LocalStorage persistence.
// - Material-UI design with gold and ginger theme.

// -------------------- Types --------------------
type Rule = { enemies: string[]; counters: string[] };

// -------------------- Utilities --------------------
const normalize = (s: string) => s.trim().toLowerCase();
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

// Parse text like: "A, B - X, Y" per line
function parseTextRules(text: string): Rule[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rules: Rule[] = [];
  for (const line of lines) {
    // allow dash variants
    const parts = line.split(/\s*-\s*/);
    if (parts.length !== 2) continue;
    const left = parts[0];
    const right = parts[1];
    const enemies = left
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const counters = right
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (enemies.length && counters.length) rules.push({ enemies, counters });
  }
  return rules;
}

// Parse JSON in object or array shape
// 1) Object: { "Hero A": ["Counter A"], "Hero B": ["Counter B"] }
// 2) Array of rules: [{ enemies: ["Hero A"], counters: ["Counter A"] }, ...]
function parseJSONRules(text: string): Rule[] {
  const data = JSON.parse(text);
  const out: Rule[] = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      if (
        item &&
        Array.isArray(item.enemies) &&
        Array.isArray(item.counters) &&
        item.enemies.length &&
        item.counters.length
      ) {
        out.push({ enemies: item.enemies.map(String), counters: item.counters.map(String) });
      }
    }
  } else if (data && typeof data === "object") {
    for (const [enemy, counters] of Object.entries<string | string[]>(data)) {
      const enemies = String(enemy).split(",").map((s) => s.trim()).filter(Boolean);
      const countersArr = Array.isArray(counters)
        ? counters.map(String)
        : String(counters)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      if (enemies.length && countersArr.length) out.push({ enemies, counters: countersArr });
    }
  }
  return out;
}

// Turn rules into a normalized lookup map where each single enemy maps to an array of counters.
function toLookup(rules: Rule[]): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};
  for (const rule of rules) {
    for (const enemy of rule.enemies) {
      const key = normalize(enemy);
      if (!map[key]) map[key] = new Set<string>();
      for (const c of rule.counters) map[key].add(c.trim());
    }
  }
  const result: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(map)) result[k] = Array.from(v);
  return result;
}

function scoreCounters(
  lookup: Record<string, string[]>,
  enemyList: string[],
  strategy: "frequency" | "intersect"
): { name: string; score: number }[] {
  const normalizedEnemies = enemyList.map(normalize);
  const perEnemyCounters = normalizedEnemies.map((e) => lookup[e] || []);

  if (strategy === "intersect") {
    if (!perEnemyCounters.length) return [];
    const base = new Set(perEnemyCounters[0]);
    for (let i = 1; i < perEnemyCounters.length; i++) {
      const s = new Set(perEnemyCounters[i]);
      for (const val of Array.from(base)) if (!s.has(val)) base.delete(val);
    }
    return Array.from(base)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ name, score: enemyList.length }));
  }

  // frequency strategy: rank by how many enemies a hero counters
  const freq: Record<string, number> = {};
  for (const list of perEnemyCounters) {
    for (const h of uniq(list)) freq[h] = (freq[h] || 0) + 1;
  }
  const ranked = Object.entries(freq)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, score]) => ({ name, score }));
  return ranked;
}

// -------------------- Default Seed Rules --------------------
const SEED_TEXT = `
Hanabi - Popol & Kupa, Moskov, Faramis, Valentina
Granger - Karina, Hanabi, Ixia, Melissa, Gatot
Lesley - Claude, Belerick, Gatot, Bruno, Ling
Layla - Faramis, Diggie, Cyclops, Rafaela, Kaja
Miya - Irithel, Faramis, Saber, Moskov, Xavier
Irithel - Benedetta, Argus, Sun, Minsitthar, XBorg
Moskov - Gloo, Hanzo, Fanny, Benedetta, Joy
Kimmy - Sun, Balmond, Alice, Hanzo, Atlas
Ixia - Estes, Esmeralda, Floryn, Bane, Mathilda
Wanwan - Atlas, Ixia, Gloo, Yin, Guinevere
Clint - Belerick, Lolita, Karina, Nolan, Barats
Melissa - Lolita, Sun, Mathilda, Alucard, Natalia
Brody - Belerick, Katarina, Fanny, Irithel, Natalia
Popol & Kupa - Kaja, Harley, Harith, Diggie, Cyclops
Harith - Lolita, Atlas, Uranus, Irithel, Paquito
Franco - Angela, Floryn, Diggie, Fanny, Estes
Chang'e - Balmond, Masha, Diggie, Novaria, Lancelot
Alpha - Phoveus, Alucard, Barats, Eudora, Odette
Lancelot - Atlas, Baxia, Alpha, Johnson, Khufra
Angela - Alice, Novaria, Balmond, Uranus, Carmilla
Gatot - Miya, Zilong, Layla, Hanabi, Odette
Pharsa - Lolita, Hanabi, Phoveus, Belerick, Melissa
Badang - Sun, Fanny, Aldous, Zilong, Silvanna
Nana - Odette, Eudora, Alucard, Saber, Freya
Sun - Masha, Cici, Eudora, Diggie, Harley
Tigreal - Zilong, Silvanna, Layla, Aulus, Eudora
Alucard - Sun, Mathilda, Natalia, Yve, Gloo
Chou - XBorg, Gord, Fanny, Natalia, Ixia
Dyrroth - Esmeralda, Faramis, Alucard, Alice, Uranus
Gusion - XBorg, Suyou, Valir, Natalia
Zilong - XBorg, Angela, Xavier, Diggie, Novaria
Cici - Benedetta, Thamuz, Balmond, Hylos, Akai
Hayabusa - Carmilla, Zhuxin, Aamon, Xavier, XBorg
Zetian - Lolita, Natalia, Tigreal, Helcurt, Benedetta
Cecilion - Lolita, Faramis, Edith, Thamuz, Luo Yi
Aamon - Cici, Ling, Masha, Xavier, Hilda
Belerick - Miya, Melissa, Hanabi, Johnson, Silvanna
Vexana - Lolita, Gloo, Zhask, Sun, Odette
Floryn - Faramis, Belerick, XBorg, Phoveus, Argus
Roger - Balmond, Argus, Harley, Aldous, Gusion
Grock - Silvanna, Atlas, Khufra, Tigreal, Johnson
Selena - XBorg, Lylia, Vale, Ixia, Alpha
Kadita - Lolita, Ixia, Atlas, Johnson, Hayabusa
Eudora - Irithel, Harley, Zilong, Hayabusa, Valentina
Saber - Natalia, Nolan, Hayabusa, Ling, Benedetta
Johnson - Layla, Eudora, Saber, Valentina, Zilong
Vale - Odette, Bane, Faramis, Zilong, Aulus
XBorg - Barats, Terizla, Ruby, Cici, Baxia
Arlott - XBorg, Ruby, Khufra, Esmeralda, Valir
Natan - Balmond, Gloo, Sun, Zhask, Johnson
Yu Zhong - Popol & Kupa, Gloo, Lolita, Esmeralda, Minsitthar
Julian - Faramis, Diggie, Sun, Esmeralda, Uranus
Uranus - Argus, Yi Sun-shin, Zhask, Faramis, Zetian
Valir - Fredrinn, Thamuz, Barats, Alucard, Aulus
Phoveus - Wanwan, Ruby, Valentina, Harith, Lukas
LapuLapu - Argus, Popol & Kupa, Atlas, Sun, Hanabi
Xavier - Belerick, Barats, Baxia, Terizla, Gloo
Yi Sun-shin - Melissa, Balmond, Khufra, Hanzo, Valir
Yin - Estes, Diggie, Floryn, Angela, Alucard
Fredrinn - Alucard, Esmeralda, Argus, Silvanna, Lunox
Estes - Faramis, Cici, Cyclops, Lesley, Diggie
Minsitthar - Freya, Harith, Phoveus, Estes, Silvanna
Cyclops - Joy, Wanwan, Natalia, Valentina, Mathilda
Ling - Atlas, Balmond, Hanzo, Gloo, Alpha
Ruby - Sun, Argus, Gloo, Masha, Silvanna
Odette - Aamon, Kaja, Cici, Joy, Natalia
Karina - Kimmy, Helcurt, Wanwan, Natalia, Zilong
Beatrix - Barats, Hanabi, Edith, Estes, Chip
Gord - Barats, Phoveus, Baxia, Lolita, Terizla
Karrie - Alice, Akai, Barats, Fredrinn, Uranus
Fanny - Gloo, Atlas, Lolita, Granger, Balmond
Esmeralda - Lolita, Argus, LapuLapu, Freya, Mathilda
Helcurt - Xavier, Layla, Lolita, Harley, Bane
Kalea - Kaja, Claude, Esmeralda, Hilda, Paquito
Claude - Lolita, Atlas, Hylos, Ixia, Balmond
Kagura - Lolita, Karina, Nana, Hanzo, Silvanna
Harley - Alice, Martis, Thamuz, Aulus, Balmond
Carmilla - Chip, Popol & Kupa, Silvanna, Atlas, Miya
Gloo - Aamon, Selena, Hylos, Lolita, Brody
Guinevere - Uranus, X-Borg, Yve, Floryn, Estes
Lukas - Faramis, Masha, Arlott, Silvanna, Saber
Rafaela - Natalia, Alice, Valir, Kaja, Cici
Jawhead - Zilong, Arlott, Paquito, Bruno, Floryn
Silvanna - Kaja, Aamon, Sun, Angela, Cyclops
Argus - Masha, Saber, Minsitthar, Odette, Guinevere
Akai - Argus, Masha, Tigreal, Atlas, Luo Yi
Hylos - Eudora, Yin, Layla, Nana, Barats
Novaria - Faramis, Luo Yi, Leomord, Yve, Tigreal
Benedetta - Valir, Silvanna, Alpha, Thamuz, Atlas
Hilda - Nolan, Novaria, Yi Sun-shin, Helcurt, Granger
Aldous - Xavier, Sun, Diggie, Uranus, X-Borg
Balmond - Saber, Martis, Faramis, Eudora, Lukas
Terizla - Masha, Argus, Sun, Johnson, Eudora
Thamuz - Alucard, Masha, Alice, Kagura, Lukas
Atlas - Layla, Estes, Aulus, Eudora, Popol & Kupa
Hanzo - Ixia, Kaja, Barats, Bane, Faramis
Martis - Masha, Saber, Faramis, Chip, Alucard
Zhask - Diggie, Zhuxin, Wanwan, Harley, Arlott
Suyou - Faramis, Sun, Argus, Lylia, Aulus
Bruno - Wanwan, Benedetta, Ling, Irithel, Fanny
Aurora - Lolita, Eudora, Aulus, Odette, Freya
Minotaur - Lolita, Khufra, Johnson, Silvanna, Argus
Lylia - Johnson, Dyrroth, Alpha, Balmond, Miya
Joy - Atlas, X-Borg, Baxia, Lolita, Luo Yi
Freya - Mathilda, Diggie, Harith, Masha, Estes
Khufra - Yin, Silvanna, Guinevere, Eudora, Karina
Luo Yi - Aulus, Estes, Edith, Faramis, Cyclops
Lunox - Esmeralda, Gloo, Wanwan, Karina, Balmond
Bane - Faramis, Phoveus, Odette, Wanwan, Khufra
Natalia - Hanzo, Xavier, Nolan, Diggie, Ling
Zhuxin - Lolita, Aamon, Thamuz, Natalia, Edith
Yve - Lolita, Barats, Nana, Hylos, Bane
Nolan - Alice, Estes, Popol & Kupa, Rafaela, Floryn
Mathilda - Balmond, Lylia, X-Borg, Benedetta, Terizla
Paquito - Faramis, X-Borg, Natalia, Nolan, Fanny
Khaleed - Zilong, Yin, Harley, Hylos, Hanabi
Baxia - Barats, Zilong, Kimmy, Chang'e, Phoveus
Edith - Silvanna, Odette, Aldous, Zilong, Miya
Aulus - Alice, Aldous, Chip, Sun, Lunox
Alice - Atlas, Tigreal, Khufra, Barats, Gloo
Diggie - Zhuxin, Atlas, Alice, Yve, Valir
Leomord - Lolita, Natalia, Saber, Silvanna, Belerick
Lolita - Cyclops, Harley, Bane, Kimmy, Baxia
Valentina - Atlas, Lolita, Argus, X-Borg, Benedetta
Barats - Alucard, Eudora, Argus, Silvanna, Paquito
Masha - Yu Zhong, Fanny, Guinevere, Valentina, Silvanna
Kaja - Akai, Harith, Argus, Balmond, Belerick
Chip - Lolita, Leomord, Silvanna, Mathilda, Aldous
Faramis - Gloo, Lolita, Khufra, Wanwan, Lunox
Hou Yi - Luban No. 7
Luban No. 7 - Fang
Arli - Luara, Lady Sun
Luara - Loong 
Loong, Flowborn Tank - Arli
Lady Sun - Consort Yu
Consort Yu - Erin
Erin - Huang Zhong
Huang Zhong - Meng Ya
Meng Ya, other not mobile MM, - Flowborn MM
Nakoruru - Wukong
Wukong - Flowborn Tank
Flowborn Tank - Liu Bei
Augran, other not mobile Jungle - Shi
Liu Bei - Kaizer
Kaizer - Hanxin
Hanxin - Cirrus
Cirrus - Dian Wei
Dian Wei - Sun Bin
Luna, Jing, Lam, Shangguan - Liang
Pei - Diaochan 
Yuhuan - Mai
Mai - Milady
Milady - Gao
Gao - Princess Frost
Princess Frost - Kong Ming
Flowborn Mage - Shangguan
Liang - Xiao Qiao, Dolia
Xiao Qiao - Shima Yi
Gan & Mo - Prince of Lanling
Dharma - Biron
Biron - Fatih
Fatih - Miyue
Allain - Charlotte 
Charlotte - Donghuang
Mulan - Dun
Dun - Lubu
Heino - Guan Yu
Guan Yu - Sun Ce
Sun Ce - Ata
Lian Po - Zuangzhi
Zuangzhi - Ming
Ming - Cai Yan
Cai Yan - Daidya
Yaria - Zhang Fei
Donghuang - Mozi
Mozi - Shakeer
`;

const SEED_RULES: Rule[] = parseTextRules(SEED_TEXT);

// Fungsi untuk mencari hero yang mirip
function findSimilarHeroes(input: string, heroList: string[]): string[] {
  const normalizedInput = normalize(input);
  if (!normalizedInput) return [];

  return heroList
    .filter(hero => normalize(hero).includes(normalizedInput))
    .slice(0, 5); // Batasi 5 saran
}

// Fungsi untuk mendapatkan semua hero unik dari rules
function getAllHeroesFromRules(rules: Rule[]): string[] {
  const heroSet = new Set<string>();
  rules.forEach(rule => {
    rule.enemies.forEach(enemy => heroSet.add(enemy.trim()));
    rule.counters.forEach(counter => heroSet.add(counter.trim()));
  });
  return Array.from(heroSet).sort();
}

// -------------------- Theme --------------------
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#d4af37', // gold
      light: '#fff59d',
      dark: '#b06500', // ginger
    },
    secondary: {
      main: '#b06500', // ginger
    },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#cccccc',
    },
  },
  typography: {
    fontFamily: '"Russo One", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(145deg, #1a1a1a 0%, #2a2a2a 100%)',
          border: '1px solid #333',
          borderRadius: 16,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
          },
        },
      },
    },
  },
});

// -------------------- Main Component --------------------
export default function App() {
  const [rules, setRules] = useState<Rule[]>(SEED_RULES);
  const [input, setInput] = useState("");
  const [strategy, setStrategy] = useState<"frequency" | "intersect">("frequency");
  const [importMode, setImportMode] = useState<"text" | "json">("text");
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem("hok_rules_v1", JSON.stringify(rules));
    } catch (error) {
      console.warn('Failed to save rules to localStorage:', error);
    }
  }, [rules]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("hok_rules_v1");
      if (saved) {
        const parsed = parseJSONRules(saved);
        if (parsed.length) setRules(parsed);
      }
    } catch (error) {
      console.warn('Failed to load rules from localStorage:', error);
    }
  }, []);

  const lookup = useMemo(() => toLookup(rules), [rules]);

  // Gabungkan hero dari rules dan daftar default
  // Ambil semua hero dari rules yang ada
  const allAvailableHeroes = useMemo(() => {
    return getAllHeroesFromRules(rules);
  }, [rules]);

  const enemies = useMemo(
    () =>
      input
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [input]
  );

  const suggestions = useMemo(() => {
    if (!enemies.length) return [] as { name: string; score: number }[];
    return scoreCounters(lookup, enemies, strategy);
  }, [lookup, enemies, strategy]);

  // Autocorrect suggestions dari data yang diimpor
  const inputSuggestions = useMemo(() => {
    const lastInput = input.split(',').pop()?.trim() || '';
    if (lastInput.length < 2) return [];
    return findSimilarHeroes(lastInput, allAvailableHeroes);
  }, [input, allAvailableHeroes]);

  const matchedDetails = useMemo(() => {
    // for each enemy show which rules matched
    return enemies.map((enemy) => {
      const key = normalize(enemy);
      const counters = lookup[key] || [];
      return { enemy, counters };
    });
  }, [lookup, enemies]);

  // Filter rules based on search query - TAMBAHKAN INI
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;

    const query = normalize(searchQuery);
    return rules.filter(rule => {
      // Search in enemies
      const enemyMatch = rule.enemies.some(enemy =>
        normalize(enemy).includes(query)
      );

      // Search in counters
      const counterMatch = rule.counters.some(counter =>
        normalize(counter).includes(query)
      );

      return enemyMatch || counterMatch;
    });
  }, [rules, searchQuery]);

  function handleImport() {
    try {
      const parsed = importMode === "text" ? parseTextRules(importText) : parseJSONRules(importText);
      if (!parsed.length) {
        alert("Tidak ada aturan valid yang ditemukan dari input.");
        return;
      }
      setRules((prev) => [...prev, ...parsed]);
      setShowImport(false);
      setImportText("");
    } catch (e: unknown) {
      alert("Gagal mengimpor: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function handleReplace() {
    try {
      const parsed = importMode === "text" ? parseTextRules(importText) : parseJSONRules(importText);
      if (!parsed.length) {
        alert("Tidak ada aturan valid yang ditemukan dari input.");
        return;
      }
      setRules(parsed);
      setShowImport(false);
      setImportText("");
    } catch (e: unknown) {
      alert("Gagal mengimpor: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function exportJSON() {
    const obj: Record<string, string[]> = {};
    for (const r of rules) {
      for (const e of r.enemies) {
        const key = e.trim();
        if (!obj[key]) obj[key] = [];
        obj[key].push(...r.counters.map((c) => c.trim()));
      }
    }
    // dedupe entries
    for (const k of Object.keys(obj)) obj[k] = uniq(obj[k]);

    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "counter-rules.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRuleSelection(index: number, checked: boolean) {
    setSelectedRules(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(index);
      } else {
        newSet.delete(index);
      }
      return newSet;
    });
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedRules(new Set(rules.map((_, index) => index)));
    } else {
      setSelectedRules(new Set());
    }
  }

  function handleDeleteSelected() {
    if (selectedRules.size === 0) {
      alert("Pilih minimal satu aturan untuk dihapus.");
      return;
    }

    if (confirm(`Hapus ${selectedRules.size} aturan yang dipilih?`)) {
      setRules(prev => prev.filter((_, index) => !selectedRules.has(index)));
      setSelectedRules(new Set());
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', width: '100%' }}>
        {/* Header - dipindahkan keluar dari Container */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #b06500 0%, #d4af37 60%, #fff59d 120%)',
            py: 6,
            mb: 4,
            width: '100%'
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ px: 3 }}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2rem', md: '3rem' },
                  color: 'black',
                  fontWeight: 700,
                  textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                Counter Pick Helper
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  mt: 1,
                  color: 'rgba(0,0,0,0.8)',
                  fontWeight: 500,
                }}
              >
                Ketik hero musuh dipisahkan koma, lalu dapatkan rekomendasi counter pick.
              </Typography>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg">
          <Box sx={{ px: 3 }}>
            {/* Input Section */}
            <Card sx={{ mb: 4, p: 3 }}>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  Hero musuh (pisahkan dengan koma)
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
                  <Box sx={{ flex: 1, position: 'relative' }}>
                    <TextField
                      fullWidth
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onBlur={() => {
                        // Delay untuk memungkinkan klik pada suggestion
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Contoh: Hero A, Hero B"
                      variant="outlined"
                    />

                    {/* Autocorrect Suggestions */}
                    {showSuggestions && inputSuggestions.length > 0 && (
                      <Paper
                        sx={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 1000,
                          maxHeight: 200,
                          overflow: 'auto',
                          mt: 1,
                          border: '1px solid #333',
                        }}
                      >
                        {inputSuggestions.map((hero, index) => (
                          <Box
                            key={index}
                            sx={{
                              p: 1.5,
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: 'primary.main',
                                color: 'black',
                              },
                              borderBottom: index < inputSuggestions.length - 1 ? '1px solid #333' : 'none',
                            }}
                            onClick={() => {
                              const parts = input.split(',');
                              parts[parts.length - 1] = hero;
                              setInput(parts.join(', ') + ', ');
                              setShowSuggestions(false);
                            }}
                          >
                            <Typography variant="body2">{hero}</Typography>
                          </Box>
                        ))}
                      </Paper>
                    )}
                  </Box>

                  <ButtonGroup variant="outlined">
                    <Button
                      variant={strategy === "frequency" ? "contained" : "outlined"}
                      onClick={() => setStrategy("frequency")}
                      title="Urutkan rekomendasi berdasarkan seberapa banyak hero tersebut menjadi counter untuk daftar musuh"
                    >
                      Frekuensi
                    </Button>
                    <Button
                      variant={strategy === "intersect" ? "contained" : "outlined"}
                      onClick={() => setStrategy("intersect")}
                      title="Tampilkan hanya hero yang menjadi counter untuk SEMUA musuh yang diinput"
                    >
                      Irisan
                    </Button>
                  </ButtonGroup>
                </Box>

                {/* Suggestions */}
                <Typography variant="h6" color="primary" gutterBottom>
                  Rekomendasi Counter Pick
                </Typography>

                {enemies.length === 0 ? (
                  <Alert severity="info">
                    Tulis minimal satu hero musuh untuk melihat rekomendasi.
                  </Alert>
                ) : suggestions.length === 0 ? (
                  <Alert severity="warning">
                    Belum ada rekomendasi yang cocok. Tambahkan aturan baru lewat <strong>Impor</strong>.
                  </Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                    {suggestions.map((suggestion, index) => (
                      <Chip
                        key={suggestion.name}
                        label={`${index + 1}. ${suggestion.name} (${suggestion.score})`}
                        variant="outlined"
                        color="primary"
                        sx={{
                          background: index < 3
                            ? 'linear-gradient(145deg, #d4af37, #b06500)'
                            : 'linear-gradient(145deg, #1a1a1a, #2a2a2a)',
                          border: '1px solid #d4af37',
                          color: index < 3 ? 'black' : 'inherit',
                          fontWeight: index < 3 ? 'bold' : 'normal',
                        }}
                      />
                    ))}
                  </Box>
                )}

                {/* Matched detail */}
                {enemies.length > 0 && (
                  <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" color="primary" gutterBottom>
                      Detail Kecocokan Aturan
                    </Typography>
                    <Grid container spacing={2}>
                      {matchedDetails.map(({ enemy, counters }) => (
                        <Grid size={{ xs: 12, md: 6 }} key={enemy}>
                          <Card variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Musuh
                            </Typography>
                            <Typography variant="h6" gutterBottom>
                              {enemy}
                            </Typography>
                            <Typography variant="subtitle2" color="text.secondary">
                              Counter:
                            </Typography>
                            {counters.length ? (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                                {counters.map((c) => (
                                  <Chip key={c} label={c} size="small" variant="outlined" />
                                ))}
                              </Box>
                            ) : (
                              <Typography color="text.secondary">(Belum ada data)</Typography>
                            )}
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Knowledge Base Section */}
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="h5" color="primary" gutterBottom>
                      Basis Pengetahuan
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {rules.length} aturan total • {filteredRules.length} ditampilkan
                      {selectedRules.size > 0 && ` • ${selectedRules.size} dipilih`}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {selectedRules.size > 0 && (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleDeleteSelected}
                      >
                        Hapus ({selectedRules.size})
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      startIcon={<DescriptionIcon />}
                      onClick={() => {
                        setShowImport(true);
                        setImportMode("text");
                      }}
                    >
                      Impor (Text)
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<CodeIcon />}
                      onClick={() => {
                        setShowImport(true);
                        setImportMode("json");
                      }}
                    >
                      Impor (JSON)
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={exportJSON}
                    >
                      Ekspor (JSON)
                    </Button>
                  </Box>
                </Box>

                {/* Search Box */}
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari hero musuh atau counter..."
                    variant="outlined"
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                    sx={{ maxWidth: 400 }}
                  />
                </Box>

                {/* Preview table of rules */}
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            indeterminate={selectedRules.size > 0 && selectedRules.size < filteredRules.length}
                            checked={filteredRules.length > 0 && selectedRules.size === filteredRules.length}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </TableCell>
                        <TableCell><strong>Musuh</strong></TableCell>
                        <TableCell><strong>Counter</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRules.map((r, idx) => {
                        // Find original index for selection handling
                        const originalIdx = rules.findIndex(rule =>
                          rule.enemies.length === r.enemies.length &&
                          rule.counters.length === r.counters.length &&
                          rule.enemies.every((enemy, i) => enemy === r.enemies[i]) &&
                          rule.counters.every((counter, i) => counter === r.counters[i])
                        );

                        return (
                          <TableRow key={`${originalIdx}-${idx}`} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedRules.has(originalIdx)}
                                onChange={(e) => handleRuleSelection(originalIdx, e.target.checked)}
                              />
                            </TableCell>
                            <TableCell sx={{ verticalAlign: 'top' }}>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {r.enemies.map((e) => {
                                  const isHighlighted = searchQuery.trim() && normalize(e).includes(normalize(searchQuery));
                                  return (
                                    <Chip
                                      key={e}
                                      label={e}
                                      size="small"
                                      variant="outlined"
                                      sx={isHighlighted ? {
                                        backgroundColor: 'primary.main',
                                        color: 'black',
                                        fontWeight: 'bold'
                                      } : {}}
                                    />
                                  );
                                })}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ verticalAlign: 'top' }}>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {r.counters.map((c) => {
                                  const isHighlighted = searchQuery.trim() && normalize(c).includes(normalize(searchQuery));
                                  return (
                                    <Chip
                                      key={c}
                                      label={c}
                                      size="small"
                                      variant="outlined"
                                      sx={isHighlighted ? {
                                        backgroundColor: 'primary.main',
                                        color: 'black',
                                        fontWeight: 'bold'
                                      } : {}}
                                    />
                                  );
                                })}
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredRules.length === 0 && searchQuery.trim() && (
                        <TableRow>
                          <TableCell colSpan={3} sx={{ textAlign: 'center', py: 4 }}>
                            <Typography color="text.secondary">
                              Tidak ada aturan yang cocok dengan pencarian "{searchQuery}"
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        </Container>

        {/* Import Modal */}
        <Dialog
          open={showImport}
          onClose={() => setShowImport(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              background: 'linear-gradient(145deg, #1a1a1a, #2a2a2a)',
              border: '1px solid #333',
            }
          }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  background: 'linear-gradient(145deg, #d4af37, #b06500)',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                }}
              >
                {importMode === 'text' ? '📝' : '🔧'}
              </Box>
              <Typography variant="h5" color="primary">
                Impor Aturan ({importMode.toUpperCase()})
              </Typography>
            </Box>
            <IconButton onClick={() => setShowImport(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent>
            <Box sx={{ mb: 3 }}>
              {importMode === "text" ? (
                <>
                  <Typography variant="body2" gutterBottom>
                    Format per baris: <code>Enemy A, Enemy B - Our X, Our Y</code>
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default', fontFamily: '"Russo One", sans-serif', fontSize: '0.875rem' }}>
                    {`Contoh:
Hero A - Counter A
Hero B - Counter B
`}
                  </Paper>
                </>
              ) : (
                <>
                  <Typography variant="body2" gutterBottom>
                    Dukungan 2 bentuk JSON:
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {`// Object mapping
{
  "Hero A": ["Counter A"],
  "Hero B": ["Counter B"]
}
`}
                  </Paper>
                </>
              )}
            </Box>

            <TextField
              fullWidth
              multiline
              rows={10}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={importMode === "text" ? "Tempel baris aturan di sini..." : "Tempel JSON di sini..."}
              variant="outlined"
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: '"Russo One", sans-serif',
                  fontSize: '0.875rem',
                },
              }}
            />
          </DialogContent>

          <DialogActions sx={{ p: 3, gap: 1 }}>
            <Button variant="outlined" onClick={handleImport}>
              Tambah ke Aturan
            </Button>
            <Button variant="outlined" onClick={handleReplace}>
              Ganti Semua Aturan
            </Button>
            <Button
              variant="outlined"
              onClick={() => setImportMode(importMode === "text" ? "json" : "text")}
            >
              Ganti ke {importMode === "text" ? "JSON" : "Text"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Footer */}
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Container maxWidth="lg">
            <Typography variant="body2">
              Dibuat oleh{' '}
              <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                White Death
              </Box>
              . Simpan otomatis ke browser. Ekspor JSON untuk backup atau berbagi.
            </Typography>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
