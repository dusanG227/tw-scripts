import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { TROOP_TYPES, parseCoords, generateBookmarklet, generateFakeScript, generateHostedBookmarklet, getDistance } from '@/lib/tw-units';

const Index = () => {
  // Generator config
  const [worldNumber, setWorldNumber] = useState('');
  const [adminId, setAdminId] = useState('');
  const [databaseName, setDatabaseName] = useState('');
  const [scriptUrl, setScriptUrl] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  // Fake config
  const [targetCoords, setTargetCoords] = useState('');
  const [originCoord, setOriginCoord] = useState('');
  const [worldSpeed, setWorldSpeed] = useState(1);
  const [unitSpeed, setUnitSpeed] = useState(1);
  const [troopConfig, setTroopConfig] = useState<Record<string, number>>({});
  const [arrivalStart, setArrivalStart] = useState('');
  const [arrivalEnd, setArrivalEnd] = useState('');
  const [useFangs, setUseFangs] = useState(false);
  const [fakeLimit, setFakeLimit] = useState(0.5);
  const [hostedScriptUrl, setHostedScriptUrl] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [openTabs, setOpenTabs] = useState(1);

  const parsedTargets = useMemo(() => parseCoords(targetCoords), [targetCoords]);
  const parsedOrigin = useMemo(() => {
    const o = parseCoords(originCoord);
    return o.length > 0 ? o[0] : null;
  }, [originCoord]);

  const totalPop = useMemo(() => {
    return Object.entries(troopConfig).reduce((sum, [id, count]) => {
      const troop = TROOP_TYPES.find(t => t.id === id);
      return sum + (troop ? troop.pop * count : 0);
    }, 0);
  }, [troopConfig]);

  const handleGenerateLink = () => {
    if (!worldNumber || !adminId || !databaseName || !scriptUrl) {
      toast({ title: 'Chyba', description: 'Vyplň všetky polia', variant: 'destructive' });
      return;
    }
    const link = generateBookmarklet({ worldNumber, adminId, databaseName, scriptUrl });
    setGeneratedLink(link);
    toast({ title: '✅ Link vygenerovaný!' });
  };

  const handleGenerateFakes = () => {
    if (!parsedOrigin || parsedTargets.length === 0) {
      toast({ title: 'Chyba', description: 'Zadaj pôvod a cieľové súradnice', variant: 'destructive' });
      return;
    }
    const script = generateFakeScript({
      targets: parsedTargets,
      troopConfig,
      worldSpeed,
      unitSpeed,
      origin: parsedOrigin,
      arrivalWindow: arrivalStart && arrivalEnd ? { start: arrivalStart, end: arrivalEnd } : undefined,
      fakeLimit,
      openTabs,
    });
    setGeneratedScript(script);
    toast({ title: `✅ Vygenerované pre ${parsedTargets.length} cieľov!` });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: '📋 Skopírované!' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚔️</span>
            <div>
              <h1 className="text-xl font-bold text-foreground font-mono tracking-tight">
                TW Fake Script Generator
              </h1>
              <p className="text-xs text-muted-foreground">Tribal Wars • Generátor falošných útokov</p>
            </div>
          </div>
          <Badge variant="outline" className="border-primary/50 text-primary font-mono text-xs">
            v2.0
          </Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="generator" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger value="generator" className="font-mono text-sm">🔗 Generátor linku</TabsTrigger>
            <TabsTrigger value="fakes" className="font-mono text-sm">💀 Fakes / Nukes</TabsTrigger>
            <TabsTrigger value="preview" className="font-mono text-sm">📋 Výstup</TabsTrigger>
          </TabsList>

          {/* TAB 1: Link Generator */}
          <TabsContent value="generator" className="space-y-4 mt-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg font-mono flex items-center gap-2">
                  <span className="text-primary">▸</span> Generátor bookmarklet linku
                </CardTitle>
                <CardDescription>
                  Vytvor spúšťací link, ktorý vložíš do prehliadača ako záložku
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-mono text-muted-foreground">Číslo sveta</Label>
                    <Input
                      placeholder="napr. 120"
                      value={worldNumber}
                      onChange={e => setWorldNumber(e.target.value)}
                      className="bg-input font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-mono text-muted-foreground">Admin ID</Label>
                    <Input
                      placeholder="ID hráča"
                      value={adminId}
                      onChange={e => setAdminId(e.target.value)}
                      className="bg-input font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-mono text-muted-foreground">Názov databázy</Label>
                    <Input
                      placeholder="napr. moj_kmen/svet120"
                      value={databaseName}
                      onChange={e => setDatabaseName(e.target.value)}
                      className="bg-input font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-mono text-muted-foreground">URL skriptu</Label>
                    <Input
                      placeholder="https://..."
                      value={scriptUrl}
                      onChange={e => setScriptUrl(e.target.value)}
                      className="bg-input font-mono"
                    />
                  </div>
                </div>
                <Button onClick={handleGenerateLink} className="w-full font-mono">
                  ⚡ Vygenerovať link
                </Button>

                {generatedLink && (
                  <div className="space-y-2 p-4 rounded-lg bg-muted border border-primary/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-mono text-primary">Vygenerovaný link:</Label>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedLink)}>
                        Kopírovať
                      </Button>
                    </div>
                    <code className="block text-xs bg-background p-3 rounded border border-border break-all text-foreground max-h-32 overflow-auto">
                      {generatedLink}
                    </code>
                    <p className="text-xs text-muted-foreground">
                      💡 Skopíruj a vlož ako URL novej záložky v prehliadači. Potom ju klikni v hre.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Fake/Nuke Config */}
          <TabsContent value="fakes" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Origin & World settings */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-mono flex items-center gap-2">
                    <span className="text-primary">▸</span> Nastavenia sveta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-mono text-muted-foreground">Pôvodná dedina (x|y)</Label>
                    <Input
                      placeholder="500|500"
                      value={originCoord}
                      onChange={e => setOriginCoord(e.target.value)}
                      className="bg-input font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-mono text-muted-foreground">Rýchlosť sveta</Label>
                      <Input
                        type="number"
                        min={1}
                        value={worldSpeed}
                        onChange={e => setWorldSpeed(Number(e.target.value))}
                        className="bg-input font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-mono text-muted-foreground">Rýchlosť jednotiek</Label>
                      <Input
                        type="number"
                        min={1}
                        value={unitSpeed}
                        onChange={e => setUnitSpeed(Number(e.target.value))}
                        className="bg-input font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-mono text-muted-foreground">Limit fakov (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={fakeLimit}
                      onChange={e => setFakeLimit(Number(e.target.value))}
                      className="bg-input font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-mono text-muted-foreground">URL hostovaného skriptu (voliteľné)</Label>
                    <Input
                      placeholder="https://dl.dropboxusercontent.com/..."
                      value={hostedScriptUrl}
                      onChange={e => setHostedScriptUrl(e.target.value)}
                      className="bg-input font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-mono text-muted-foreground">Počet tabov (open tabs)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={openTabs}
                      onChange={e => setOpenTabs(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                      className="bg-input font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Koľko rally point tabov sa otvorí naraz v hre
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Switch checked={useFangs} onCheckedChange={setUseFangs} />
                    <Label className="text-sm font-mono text-muted-foreground">Použiť Fangs mód</Label>
                  </div>
                </CardContent>
              </Card>

              {/* Arrival window */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-mono flex items-center gap-2">
                    <span className="text-primary">▸</span> Okno príchodu
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-mono text-muted-foreground">Príchod od</Label>
                    <Input
                      type="datetime-local"
                      value={arrivalStart}
                      onChange={e => setArrivalStart(e.target.value)}
                      className="bg-input font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-mono text-muted-foreground">Príchod do</Label>
                    <Input
                      type="datetime-local"
                      value={arrivalEnd}
                      onChange={e => setArrivalEnd(e.target.value)}
                      className="bg-input font-mono"
                    />
                  </div>
                  {parsedOrigin && parsedTargets.length > 0 && (
                    <div className="p-3 rounded bg-muted text-xs font-mono space-y-1">
                      <p className="text-muted-foreground">📊 Štatistiky:</p>
                      <p>Cieľov: <span className="text-primary">{parsedTargets.length}</span></p>
                      <p>Min vzdialenosť: <span className="text-primary">
                        {Math.min(...parsedTargets.map(t => getDistance(parsedOrigin.x, parsedOrigin.y, t.x, t.y))).toFixed(1)}
                      </span></p>
                      <p>Max vzdialenosť: <span className="text-primary">
                        {Math.max(...parsedTargets.map(t => getDistance(parsedOrigin.x, parsedOrigin.y, t.x, t.y))).toFixed(1)}
                      </span></p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Troop config */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-mono flex items-center gap-2">
                  <span className="text-primary">▸</span> Jednotky
                  <Badge variant="secondary" className="font-mono text-xs ml-auto">
                    Pop: {totalPop}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {TROOP_TYPES.map(troop => (
                    <div
                      key={troop.id}
                      className="p-3 rounded-lg bg-muted border border-border hover:border-primary/40 transition-colors space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{troop.icon}</span>
                        <span className="text-xs font-mono text-muted-foreground truncate">{troop.name}</span>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={troopConfig[troop.id] || ''}
                        onChange={e => setTroopConfig(prev => ({ ...prev, [troop.id]: parseInt(e.target.value) || 0 }))}
                        className="bg-input font-mono h-8 text-sm"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                        <span>pop: {troop.pop}</span>
                        <Badge variant={troop.offensive ? 'default' : 'secondary'} className="text-[9px] h-4 px-1">
                          {troop.offensive ? 'OFF' : 'DEF'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Target coords */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-mono flex items-center gap-2">
                  <span className="text-primary">▸</span> Cieľové súradnice
                  <Badge variant="outline" className="font-mono text-xs ml-auto border-primary/50 text-primary">
                    {parsedTargets.length} cieľov
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Vlož súradnice (napr. 500|500 501|501 502|502)..."
                  value={targetCoords}
                  onChange={e => setTargetCoords(e.target.value)}
                  className="bg-input font-mono min-h-[120px] text-sm"
                />
                <Button onClick={handleGenerateFakes} className="w-full font-mono">
                  ⚔️ Vygenerovať {useFangs ? 'Fangs' : 'Fakes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Output */}
          <TabsContent value="preview" className="space-y-4 mt-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg font-mono flex items-center gap-2">
                  <span className="text-primary">▸</span> Vygenerovaný výstup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {generatedScript ? (
                  <>
                    {/* Bookmarklet na použitie v hre */}
                    <div className="p-4 rounded-lg bg-muted border border-primary/30 space-y-2">
                      <Label className="text-sm font-mono text-primary">🔖 Bookmarklet (vlož ako záložku):</Label>
                      <code className="block text-[10px] bg-background p-3 rounded border border-border break-all text-foreground max-h-24 overflow-auto">
                        {hostedScriptUrl 
                          ? generateHostedBookmarklet(generatedScript, hostedScriptUrl)
                          : generateHostedBookmarklet(generatedScript)
                        }
                      </code>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(
                          hostedScriptUrl 
                            ? generateHostedBookmarklet(generatedScript, hostedScriptUrl)
                            : generateHostedBookmarklet(generatedScript)
                        )}>
                          📋 Kopírovať bookmarklet
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        💡 Vytvor novú záložku → vlož tento kód ako URL → otvor rally point v hre → klikni záložku
                      </p>
                    </div>

                    {/* Surový skript */}
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-mono text-muted-foreground">Surový skript:</Label>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedScript)}>
                        📋 Kopírovať skript
                      </Button>
                    </div>
                    <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-foreground overflow-auto max-h-[400px] whitespace-pre-wrap">
                      {generatedScript}
                    </pre>
                  </>
                ) : (
                  <div className="text-center py-16 text-muted-foreground font-mono text-sm">
                    <span className="text-4xl block mb-4">📭</span>
                    Zatiaľ nič nevygenerované. Použi záložku "Fakes / Nukes".
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-4 text-center text-xs text-muted-foreground font-mono">
        TW Fake Script Generator v2.0 • Pre Tribal Wars
      </footer>
    </div>
  );
};

export default Index;

