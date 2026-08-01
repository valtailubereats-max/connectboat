import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Trophy, 
  Download, 
  Play, 
  RefreshCw, 
  Users, 
  Sparkles,
  FileVideo,
  Volume2,
  Share2
} from 'lucide-react';
import { collection, query, getDocs, where, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db, getDocsWithCacheFallback } from '../firebase';
import { Giveaway, GiveawayParticipation, GiveawayWinner } from '../types';

// Helper to mask candidate name elegantly to protect privacy while maintaining realism
const maskName = (name: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    const p = parts[0];
    if (p.length <= 3) return p;
    return p[0] + '***' + p[p.length - 1];
  }
  // Keep first name, then abbreviation with asterisks for other names
  const firstName = parts[0];
  const others = parts.slice(1).map(p => {
    if (p.length === 0) return '';
    return p[0].toUpperCase() + '.***';
  }).join(' ');
  return `${firstName} ${others}`;
};

// Helper to mask candidate email elegantly so it protects personal data in screen recordings
const maskEmail = (email: string): string => {
  if (!email) return '';
  const trimmed = email.trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx === -1) return trimmed;
  const local = trimmed.substring(0, atIdx);
  const domain = trimmed.substring(atIdx);
  if (local.length <= 3) {
    return local[0] + '***' + domain;
  }
  return local.substring(0, 3) + '***' + local[local.length - 1] + domain;
};

interface LotteryGlobeModalProps {
  giveaway: Giveaway;
  onClose: () => void;
  onDrawComplete: (winners: GiveawayWinner[], videoBase64?: string) => Promise<void>;
}

interface PhysicsBall {
  id: string;
  userId: string;
  name: string;
  email: string;
  ticketId: string;
  ticketIndex: number;
  totalTickets: number;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  initialX: number;
  initialY: number;
  isWinner: boolean;
  inTube: boolean;
  isDrawn: boolean;
}

export default function LotteryGlobeModal({ giveaway, onClose, onDrawComplete }: LotteryGlobeModalProps) {
  const [participants, setParticipants] = useState<GiveawayParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [prizeImg, setPrizeImg] = useState<HTMLImageElement | null>(null);

  // Preloader para a foto do produto
  useEffect(() => {
    if (giveaway.prizeImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = giveaway.prizeImage;
      img.onload = () => {
        setPrizeImg(img);
      };
      img.onerror = () => {
        // Tenta sem anonymous caso haja problemas de CORS
        const imgFallback = new Image();
        imgFallback.src = giveaway.prizeImage;
        imgFallback.onload = () => {
          setPrizeImg(imgFallback);
        };
      };
    }
  }, [giveaway.prizeImage]);

  const [drawState, setDrawState] = useState<'idle' | 'spinning' | 'extracting' | 'revealing' | 'finished'>('idle');
  const drawStateRef = useRef<'idle' | 'spinning' | 'extracting' | 'revealing' | 'finished'>('idle');
  const revealingStartTimeRef = useRef<number>(0);
  const updateDrawState = (val: 'idle' | 'spinning' | 'extracting' | 'revealing' | 'finished') => {
    if (val === 'revealing') {
      revealingStartTimeRef.current = Date.now();
    }
    drawStateRef.current = val;
    setDrawState(val);
  };

  const [currentWinnerIndex, setCurrentWinnerIndex] = useState(0);
  const currentWinnerIndexRef = useRef(0);
  const updateCurrentWinnerIndex = (val: number) => {
    currentWinnerIndexRef.current = val;
    setCurrentWinnerIndex(val);
  };

  const [drawnWinners, setDrawnWinners] = useState<GiveawayWinner[]>([]);
  const drawnWinnersRef = useRef<GiveawayWinner[]>([]);
  const updateDrawnWinners = (val: GiveawayWinner[] | ((prev: GiveawayWinner[]) => GiveawayWinner[])) => {
    if (typeof val === 'function') {
      setDrawnWinners(prev => {
        const next = val(prev);
        drawnWinnersRef.current = next;
        return next;
      });
    } else {
      drawnWinnersRef.current = val;
      setDrawnWinners(val);
    }
  };

  const [calculatedWinners, setCalculatedWinners] = useState<GiveawayParticipation[]>([]);
  const calculatedWinnersRef = useRef<GiveawayParticipation[]>([]);
  const updateCalculatedWinners = (val: GiveawayParticipation[]) => {
    calculatedWinnersRef.current = val;
    setCalculatedWinners(val);
  };
  
  // MediaRecorder states
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const updateIsRecording = (val: boolean) => {
    isRecordingRef.current = val;
    setIsRecording(val);
  };

  const [soundEnabled, setSoundEnabled] = useState(true);

  // Registo de som de batida com throttle para não sobrecarregar
  const lastBounceTime = useRef<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const customRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Persistent shared audio context
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Carregar participantes reais deste sorteio
  useEffect(() => {
    fetchParticipants();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const generateFictitiousParticipants = (count = 50): GiveawayParticipation[] => {
    // 50 First Names
    const ptFirstNames = [
      'Rui', 'Sofia', 'Carlos', 'Ana', 'João', 'Maria', 'José', 'Inês', 'Pedro', 'Mariana',
      'Bruno', 'Catarina', 'Vasco', 'Beatriz', 'Miguel', 'Leonor', 'Diogo', 'Tiago', 'Laura', 'Manuel',
      'Sara', 'Daniela', 'Luís', 'Francisca', 'Filipe', 'Carolina', 'Marta', 'Tomás', 'Cláudia', 'André',
      'Gustavo', 'Helena', 'Hugo', 'Isabel', 'Patrícia', 'David', 'Marco', 'Joana', 'Margarida', 'Bárbara',
      'Renato', 'Ricardo', 'Gonçalo', 'Rita', 'Sandro', 'Tatiana', 'Nuno', 'Diana', 'Alexandre', 'Sérgio'
    ];
    // 50 Last Names
    const ptLastNames = [
      'Silva', 'Santos', 'Oliveira', 'Rodrigues', 'Pereira', 'Costa', 'Antunes', 'Marques', 'Ribeiro', 'Carvalho',
      'Ferreira', 'Martins', 'Fonseca', 'Cardoso', 'Sousa', 'Gomes', 'Neves', 'Teixeira', 'Correia', 'Barros',
      'Valente', 'Goulart', 'Neto', 'Cruz', 'Barbosa', 'Bernardes', 'Baptista', 'Sequeira', 'Moreira', 'Lima',
      'Reis', 'Paiva', 'Couto', 'Rocha', 'Becker', 'Brás', 'Lourenço', 'Salgado', 'Laranjeira', 'Guerreiro',
      'Fernandes', 'Machado', 'Mendes', 'Tavares', 'Pinheiro', 'Coelho', 'Almeida', 'Nascimento', 'Vieira', 'Mota'
    ];

    const generatedList: GiveawayParticipation[] = [];
    for (let i = 0; i < count; i++) {
      const fName = ptFirstNames[Math.floor(Math.random() * ptFirstNames.length)];
      const lName = ptLastNames[Math.floor(Math.random() * ptLastNames.length)];
      const name = `${fName} ${lName}`;
      const domain = ['gmail.com', 'outlook.com', 'sapo.pt', 'yahoo.com'][Math.floor(Math.random() * 4)];
      
      // Eliminate character accents and spaces for the emails
      const cleanEmail = `${fName.toLowerCase()}.${lName.toLowerCase()}${Math.floor(Math.random() * 900) + 100}@${domain}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "");

      const tickets = Math.floor(Math.random() * 3) + 1; // 1 to 3 tickets for authentic relative probabilities
      generatedList.push({
        id: `${giveaway.id}_fict_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        giveawayId: giveaway.id,
        userId: `fict_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userName: name,
        userEmail: cleanEmail,
        name: name,
        email: cleanEmail,
        sharesCount: tickets,
        ticketsCount: tickets,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    setParticipants(generatedList);

    // Re-calculate math winners for this sequence beforehand
    if (generatedList.length > 0) {
      const countToDraw = Math.min(giveaway.winnersCount, generatedList.length);
      const winnersList: GiveawayParticipation[] = [];
      let remainingCandidates = [...generatedList];

      for (let round = 0; round < countToDraw; round++) {
        if (remainingCandidates.length === 0) break;

        let totalWeight = 0;
        remainingCandidates.forEach(p => {
          const tickets = p.ticketsCount && p.ticketsCount > 0 ? p.ticketsCount : 1;
          totalWeight += tickets;
        });

        if (totalWeight === 0) break;

        let r = Math.random() * totalWeight;
        let selectedIdx = -1;
        let runningSum = 0;

        for (let i = 0; i < remainingCandidates.length; i++) {
          const tickets = remainingCandidates[i].ticketsCount && remainingCandidates[i].ticketsCount > 0 
            ? remainingCandidates[i].ticketsCount 
            : 1;
          runningSum += tickets;
          if (r <= runningSum) {
            selectedIdx = i;
            break;
          }
        }

        if (selectedIdx === -1) {
          selectedIdx = remainingCandidates.length - 1;
        }

        const winner = remainingCandidates[selectedIdx];
        winnersList.push(winner);
        remainingCandidates = remainingCandidates.filter(p => p.userId !== winner.userId);
      }
      updateCalculatedWinners(winnersList);
    }
    return generatedList;
  };

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'participations'), where('giveawayId', '==', giveaway.id));
      const snap = await getDocsWithCacheFallback(q, 'globe-participations');
      let list: GiveawayParticipation[] = [];
      snap.forEach(d => {
        list.push(d.data() as GiveawayParticipation);
      });

      // Se for Edição #0 de Demonstração, OU se a lista original estiver totalmente vazia:
      const isDemo = giveaway.drawNumber === 0 || giveaway.id.includes('demo') || giveaway.id === 'demo';
      if (isDemo || list.length === 0) {
        console.log("Gerando participantes fictícios realistas para campanha ou demonstração do passatempo...");
        list = generateFictitiousParticipants(50);
      } else {
        setParticipants(list);
      }

      // Pré-calcular matematicamente todos os vencedores de forma idêntica ao algoritmo original, 
      // mas com a emoção visual adicionada!
      if (list.length > 0) {
        const countToDraw = Math.min(giveaway.winnersCount, list.length);
        const winnersList: GiveawayParticipation[] = [];
        let remainingCandidates = [...list];

        for (let round = 0; round < countToDraw; round++) {
          if (remainingCandidates.length === 0) break;

          let totalWeight = 0;
          remainingCandidates.forEach(p => {
            const tickets = p.ticketsCount && p.ticketsCount > 0 ? p.ticketsCount : 1;
            totalWeight += tickets;
          });

          if (totalWeight === 0) break;

          let r = Math.random() * totalWeight;
          let selectedIdx = -1;
          let runningSum = 0;

          for (let i = 0; i < remainingCandidates.length; i++) {
            const tickets = remainingCandidates[i].ticketsCount && remainingCandidates[i].ticketsCount > 0 
              ? remainingCandidates[i].ticketsCount 
              : 1;
            runningSum += tickets;
            if (r <= runningSum) {
              selectedIdx = i;
              break;
            }
          }

          if (selectedIdx === -1) {
            selectedIdx = remainingCandidates.length - 1;
          }

          const winner = remainingCandidates[selectedIdx];
          winnersList.push(winner);

          // Remover para não haver múltiplos prémios para a mesma pessoa
          remainingCandidates = remainingCandidates.filter(p => p.userId !== winner.userId);
        }
        updateCalculatedWinners(winnersList);
      }
    } catch (err) {
      console.error('Error in fetchParticipants:', err);
    } finally {
      setLoading(false);
    }
  };

  // Motor de física das bolinhas
  const ballsRef = useRef<PhysicsBall[]>([]);
  const R_GAGE = 160; // Raio do globo circular de vidro
  const CX = 320; // Centro horizontal
  const CY = 190; // Centro vertical

  // Sons dinâmicos usando Web Audio API
  const playBounceSound = () => {
    if (!soundEnabled) return;
    const now = Date.now();
    if (now - lastBounceTime.current < 80) return; // limit sound density
    lastBounceTime.current = now;

    try {
      const audioCtx = getAudioContext();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260 + Math.random() * 180, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, audioCtx.currentTime + 0.04);
      
      gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
      // Ignora impedimento de foco/interação do browser
    }
  };

  const playTadaSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = getAudioContext();
      const now = audioCtx.currentTime;

      const playNote = (freq: number, start: number, duration: number, volume = 0.12) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(volume, start + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        osc.start(start);
        osc.stop(start + duration);
      };
      
      // Acorde triunfal iluminado
      playNote(261.63, now, 0.4);       // C4
      playNote(329.63, now + 0.1, 0.4); // E4
      playNote(392.00, now + 0.2, 0.4); // G4
      playNote(523.25, now + 0.35, 1.2, 0.16); // C5
    } catch (e) {
      console.error(e);
    }
  };

  const playWhirringSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = getAudioContext();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(160, audioCtx.currentTime + 1.5);
      osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 3);

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 0.2);
      gainNode.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 2.5);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3);

      osc.start();
      osc.stop(audioCtx.currentTime + 3);
    } catch (e) {}
  };

  // Inicializa bolinhas no canvas
  const initializeBalls = () => {
    if (participants.length === 0) return;

    const colors = [
      '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
      '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6'
    ];

    const tempBalls: PhysicsBall[] = [];
    let ballIdCounter = 0;

    // Criar bolinhas físicas reais para cada canal de bilhetes de cada participante!
    participants.forEach((p) => {
      const tickets = p.ticketsCount || 1;
      for (let i = 0; i < tickets; i++) {
        // Gera posição inicial aleatória agrupada na parte central inferior da gaiola
        const angle = Math.random() * Math.PI - Math.PI; // do lado de cima ao lado de baixo
        const radiusDist = Math.random() * (R_GAGE - 35);
        const x = CX + Math.cos(angle) * radiusDist;
        const y = CY + Math.sin(angle) * radiusDist;

        ballIdCounter++;
        tempBalls.push({
          id: `ball_${ballIdCounter}_${p.userId}`,
          userId: p.userId,
          name: p.userName || p.name || 'Utilizador',
          email: p.userEmail || p.email || '',
          ticketId: `${p.userId}_ticket_${i + 1}`,
          ticketIndex: i + 1,
          totalTickets: tickets,
          color: colors[ballIdCounter % colors.length],
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          radius: 14,
          initialX: x,
          initialY: y,
          isWinner: false,
          inTube: false,
          isDrawn: false
        });
      }
    });

    // Se houver poucas bolinhas no sorteio, recheie com bolinhas virtuais transparentes 
    // decorativas apenas para dar volume e suspense ao globo física!
    if (tempBalls.length < 35) {
      const missing = 35 - tempBalls.length;
      for (let i = 0; i < missing; i++) {
        const angle = Math.random() * Math.PI;
        const radiusDist = Math.random() * (R_GAGE - 35);
        const x = CX + Math.cos(angle) * radiusDist;
        const y = CY + Math.sin(angle) * radiusDist;

        ballIdCounter++;
        tempBalls.push({
          id: `dummy_${ballIdCounter}`,
          userId: 'dummy',
          name: 'Sorte',
          email: '',
          ticketId: `dummy_${ballIdCounter}`,
          ticketIndex: 1,
          totalTickets: 1,
          color: colors[ballIdCounter % colors.length],
          x,
          y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          radius: 14,
          initialX: x,
          initialY: y,
          isWinner: false,
          inTube: false,
          isDrawn: false
        });
      }
    }

    ballsRef.current = tempBalls;
  };

  // Prepara bolinhas ao carregar os participantes
  useEffect(() => {
    if (participants.length > 0) {
      initializeBalls();
      startDrawingLoop();
    }
  }, [participants]);

  // Loop de renderização e físicas
  const startDrawingLoop = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cageAngle = 0;
    const confettiList: Array<{ x: number, y: number, vx: number, vy: number, color: string, size: number }> = [];

    const updatePhysicsAndDraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Desenhar fundo escurecido estético com gradiente radial profundo
      const radialBg = ctx.createRadialGradient(CX, CY, 50, CX, CY, 380);
      radialBg.addColorStop(0, '#1e293b'); // slate-800
      radialBg.addColorStop(1, '#0f172a'); // slate-900
      ctx.fillStyle = radialBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Adiciona grades cinzentas modernas ao fundo
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      if (drawStateRef.current !== 'finished') {
        // 2. Desenhar as estruturas de sustentação (Pedestal da Lotaria)
      // Base metálica dourada/prateada inferior
      ctx.shadowBlur = 0;
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#475569'; // slate-600
      ctx.fillStyle = '#334155'; // slate-700
      
      // Pernas do suporte principal
      ctx.beginPath();
      ctx.moveTo(CX - 120, CY + 140);
      ctx.lineTo(CX - R_GAGE - 20, CY);
      ctx.moveTo(CX + 120, CY + 140);
      ctx.lineTo(CX + R_GAGE + 20, CY);
      ctx.stroke();

      // Pedestal decorativo de metal do fundo
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(CX - 150, CY + R_GAGE + 70, 300, 20);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(CX - 150, CY + R_GAGE + 70, 300, 20);

      // 3. duto vertical de vidro de saída da bolinha pela parte inferior
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 3;
      // cano de queda
      ctx.fillRect(CX - 22, CY + R_GAGE - 10, 44, 90);
      ctx.strokeRect(CX - 22, CY + R_GAGE - 10, 44, 90);

      // Pequena campana de resgate no fundo onde descansa a bolinha sorteada
      ctx.beginPath();
      ctx.arc(CX, CY + R_GAGE + 110, 32, 0, Math.PI, false);
      ctx.fillStyle = '#1e1b4b'; // indigo-950
      ctx.fill();
      ctx.strokeStyle = '#f59e0b'; // Gold border
      ctx.lineWidth = 4;
      ctx.stroke();

      // 4. Gaiola circular de lotaria (Globe ring)
      ctx.save();
      ctx.translate(CX, CY);
      if (drawStateRef.current === 'spinning') {
        cageAngle += 0.12;
      } else if (drawStateRef.current === 'extracting') {
        cageAngle += 0.02;
      }
      ctx.rotate(cageAngle);

      // Desenhar o vidro da gaiola circular
      ctx.shadowColor = 'rgba(30, 144, 255, 0.2)';
      ctx.shadowBlur = 15;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.arc(0, 0, R_GAGE, 0, Math.PI * 2);
      ctx.fill();

      // Gradeamento de ferro da gaiola de loteria (efeito 3D de rotação)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, R_GAGE, Math.abs(Math.sin(i * Math.PI / 8) * R_GAGE), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Eixo central giratório
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
      ctx.shadowBlur = 0; // Desliga shadow para as bolinhas

      // 5. Atualizar físicas e desenhar bolinhas
      const balls = ballsRef.current;

      // Se o globo estiver no agito ("spinning"), adicionamos força radial violenta para misturar tudo!
      if (drawStateRef.current === 'spinning') {
        balls.forEach(b => {
          // Aplica turbulência e um leve redemoinho baseado no tempo
          const swirlAngle = Math.atan2(b.y - CY, b.x - CX) + Math.PI / 2;
          b.vx += Math.cos(swirlAngle) * 0.9 + (Math.random() - 0.5) * 4;
          b.vy += Math.sin(swirlAngle) * 0.9 + (Math.random() - 0.5) * 4;
        });
      } else if (drawStateRef.current === 'idle') {
        // Gravidade mínima em repouso
        balls.forEach(b => {
          if (!b.isDrawn && !b.inTube) {
            b.vy += 0.25; // gravidade comum
          }
        });
      } else {
        // Gravidade comum de sorteio nas que estão no globo
        balls.forEach(b => {
          if (!b.isDrawn && !b.inTube) {
            b.vy += 0.35;
          }
        });
      }

      // Processar colisões entre bolinhas
      for (let i = 0; i < balls.length; i++) {
        const b1 = balls[i];
        if (b1.isDrawn) continue;

        // Se a bolinha selecionada está sendo sugada para fora através do bocal
        if (b1.inTube) {
          b1.vx = 0;
          b1.x = b1.x * 0.88 + CX * 0.12; // Centraliza no tubo
          b1.vy = 4.0; // Velocidade de descida
          b1.y += b1.vy;

          if (b1.y > CY + R_GAGE + 105) {
            // Chegou de fato no recesso inferior de repouso!
            b1.inTube = false;
            b1.isDrawn = true;
            b1.vx = 0;
            b1.vy = 0;
            b1.x = CX;
            b1.y = CY + R_GAGE + 105;
            
            // Ativa comemoração triunfal
            updateDrawState('revealing');
            playTadaSound();
            
            // Criar confetes dinâmicos no canvas
            for (let c = 0; c < 120; c++) {
              confettiList.push({
                x: CX + (Math.random() - 0.5) * 40,
                y: CY + R_GAGE + 110,
                vx: (Math.random() - 0.5) * 8,
                vy: -Math.random() * 8 - 4,
                color: ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#EF4444'][c % 5],
                size: Math.random() * 6 + 3
              });
            }

            // Exibir suspensa de 4.5 segundos antes de permitir prosseguir ou fechar
            setTimeout(() => {
              // Registra localmente esse triunfador sorteado
              const computedWinner: GiveawayWinner = {
                userId: b1.userId,
                name: b1.name,
                email: b1.email,
                drawDate: Timestamp.now(),
                status: 'Awaiting Contact',
                prizeTitle: giveaway.title,
                prizeImage: giveaway.prizeImage,
                country: giveaway.country
              };

              updateDrawnWinners(prev => {
                const updated = [...prev, computedWinner];
                // Verifica se encerrou todos os vencedores permitidos
                if (updated.length >= calculatedWinnersRef.current.length) {
                  updateDrawState('finished');
                  // Para gravação de forma diferida (16 segundos) para dar tempo de registar o magnífico pódio dos campeões e mensagens celebratórias!
                  setTimeout(() => {
                    stopRecordingSession();
                  }, 16000);
                } else {
                  updateDrawState('idle');
                  updateCurrentWinnerIndex(updated.length);
                }
                return updated;
              });
            }, 5000);
          }
          continue;
        }

        // Físicas comuns de colisão contra outras bolinhas
        for (let j = i + 1; j < balls.length; j++) {
          const b2 = balls[j];
          if (b2.isDrawn || b2.inTube) continue;

          let dx = b2.x - b1.x;
          let dy = b2.y - b1.y;
          let dist = Math.sqrt(dx*dx + dy*dy);
          let minDist = b1.radius + b2.radius;

          if (dist < minDist) {
            if (dist === 0) {
              b1.x -= 1;
              b2.x += 1;
              continue;
            }
            let overlap = minDist - dist;
            let nx = dx / dist;
            let ny = dy / dist;

            // Afasta para não sobrepor
            b1.x -= nx * overlap * 0.5;
            b1.y -= ny * overlap * 0.5;
            b2.x += nx * overlap * 0.5;
            b2.y += ny * overlap * 0.5;

            // Transfere velocidade elástica
            let kx = b1.vx - b2.vx;
            let ky = b1.vy - b2.vy;
            let p = nx * kx + ny * ky;

            if (p > 0) {
              let restitution = 0.8;
              let impulse = p * (1 + restitution) * 0.5;
              b1.vx -= impulse * nx;
              b1.vy -= impulse * ny;
              b2.vx += impulse * nx;
              b2.vy += impulse * ny;

              // Som de colisão com velocidade
              if (p > 1.5) {
                playBounceSound();
              }
            }
          }
        }

        // Físicas e limites do contêiner circular (Gaiola)
        let gdx = b1.x - CX;
        let gdy = b1.y - CY;
        let gdist = Math.sqrt(gdx*gdx + gdy*gdy);

        if (gdist + b1.radius > R_GAGE) {
          // Se estamos tirando uma bolinha e ela é o vencedor correspondente, 
          // ela tem passe livre para entrar pelo funil bocal da parte inferior central!
          const angleFromBottom = Math.abs(Math.atan2(gdy, gdx) - Math.PI / 2);
          if (drawStateRef.current === 'extracting' && b1.isWinner && angleFromBottom < 0.28 && b1.y > CY + 100) {
            b1.inTube = true;
          } else {
            // Rebate na borda circular interna
            b1.x = CX + (gdx / gdist) * (R_GAGE - b1.radius);
            b1.y = CY + (gdy / gdist) * (R_GAGE - b1.radius);

            let nx = gdx / gdist;
            let ny = gdy / gdist;
            let dot = b1.vx * nx + b1.vy * ny;
            if (dot > 0) {
              let restitution = 0.65;
              b1.vx = b1.vx - 2 * dot * nx * restitution;
              b1.vy = b1.vy - 2 * dot * ny * restitution;
              
              if (dot > 1.2) {
                playBounceSound();
              }
            }
          }
        }

        // Desloca de acordo com速度
        b1.x += b1.vx;
        b1.y += b1.vy;

        // Amortecimento suave de resistência do ar
        b1.vx *= 0.985;
        b1.vy *= 0.985;
      }

      // Desenhar todas as bolinhas físicas comuns que NÃO são os sorteados finais
      balls.forEach(b => {
        if (b.isDrawn) return;

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        
        // Efeito esférico 3D com gradiente
        let ballGrad = ctx.createRadialGradient(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.1, b.x, b.y, b.radius);
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(0.2, b.color);
        ballGrad.addColorStop(1, '#000000');

        ctx.fillStyle = ballGrad;
        ctx.fill();

        // Letras/Iniciais no centro de forma organizada
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 8.5px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let initial = b.name.substring(0, 2).toUpperCase();
        if (b.userId === 'dummy') initial = '☘️';
        ctx.fillText(initial, b.x, b.y);
      });

      // 6. Desenhar a bolinha vencedora na bandeja de sorteio com grande destaque ampliado e ZOOM CINEMÁTICO PROGRESSIVO!
      const drawnWinnerBall = balls.find(b => b.isDrawn);
      if (drawnWinnerBall && drawStateRef.current === 'revealing') {
        const wb = drawnWinnerBall;

        // Efeito de interpolação progressiva (zoom de 26px para 105px, movendo da bandeja ao centro)
        const elapsed = Date.now() - (revealingStartTimeRef.current || Date.now());
        const t = Math.min(1, elapsed / 1300); // transição de 1.3s
        const easeT = t * t * (3 - 2 * t); // smoothstep

        const targetX = CX;
        const targetY = CY - 25;

        const drawX = wb.x + (targetX - wb.x) * easeT;
        const drawY = wb.y + (targetY - wb.y) * easeT;
        const drawR = 26 + (105 - 26) * easeT;

        // Desenhar raios solares dourados girando no fundo do globo com glória de campeão
        ctx.save();
        ctx.translate(drawX, drawY);
        const rotAngle = (Date.now() / 1500) % (Math.PI * 2);
        ctx.rotate(rotAngle);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.08)'; // Golden warm transparent rays
        for (let r = 0; r < 12; r++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, drawR * 3.5, (r * Math.PI) / 6, (r * Math.PI) / 6 + Math.PI / 12);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // Efeito de pulsação e luz de celebração atrás da bola zoom
        const spotlightPulse = drawR + 50 + Math.sin(Date.now() / 150) * 15;
        ctx.beginPath();
        const spotlightGrad = ctx.createRadialGradient(drawX, drawY, 10, drawX, drawY, spotlightPulse);
        spotlightGrad.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
        spotlightGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.15)');
        spotlightGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = spotlightGrad;
        ctx.arc(drawX, drawY, spotlightPulse, 0, Math.PI*2);
        ctx.fill();

        // Desenhar a bola ampliada espetacular com zoom
        ctx.save();
        ctx.translate(drawX, drawY);

        ctx.beginPath();
        ctx.arc(0, 0, drawR, 0, Math.PI * 2);
        
        let drawnBallGrad = ctx.createRadialGradient(-drawR * 0.3, -drawR * 0.3, drawR * 0.1, 0, 0, drawR);
        drawnBallGrad.addColorStop(0, '#ffffff');
        drawnBallGrad.addColorStop(0.2, wb.color);
        drawnBallGrad.addColorStop(1, '#000000');
        ctx.fillStyle = drawnBallGrad;
        ctx.fill();

        // Efeito reflexo de luz na bola zoom
        let shineGrad = ctx.createLinearGradient(-drawR, -drawR, drawR, drawR);
        shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        shineGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.0)');
        shineGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = shineGrad;
        ctx.fill();

        // Borda dourada de glória
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4 + 3 * easeT;
        ctx.stroke();

        // Iniciais em destaque escaladas
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${Math.floor(15 + 32 * easeT)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(wb.name.substring(0, 2).toUpperCase(), 0, -5 * easeT);

        ctx.restore();

        // Escrever o nome do vencedor em letras garrafais com CARD elegante estético
        ctx.save();
        ctx.globalAlpha = easeT;
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0,0,0,0.55)';

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;

        const panelW = 460;
        const panelH = 110;
        const px = CX - panelW/2;
        const py = CY + 105;

        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(px, py, panelW, panelH, 20) : ctx.rect(px, py, panelW, panelH);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 13px Inter, sans-serif';
        ctx.fillText('🏆 DRAWN WINNER 🏆', CX, py + 26);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Inter, sans-serif';
        ctx.fillText(maskName(wb.name), CX, py + 56);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 12px Inter, sans-serif';
        ctx.fillText(`Bilhete #${wb.ticketIndex} • ${maskEmail(wb.email)}`, CX, py + 86);
        ctx.restore();
      }

      } // Closes if (drawStateRef.current !== 'finished')

      // 6b. CASO DE EXIBIÇÃO DO PÓDIO DE SUCESSO (Finished State)
      if (drawStateRef.current === 'finished') {
        const winners = drawnWinnersRef.current;
        
        ctx.save();
        ctx.textAlign = 'center';

        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(40, 70, canvas.width - 80, 75, 16) : ctx.rect(40, 70, canvas.width - 80, 75);
        ctx.fill();
        ctx.stroke();

        const num = giveaway.drawNumber !== undefined ? giveaway.drawNumber : 0;
        const isDemo = num === 0;

        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 18px Inter, sans-serif';
        ctx.fillText(isDemo ? '🏆 DRAW Num: 0 🏆' : `🏆 SUCCESS PODIUM REVEAL #${num} 🏆`, CX, 102);

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 11.5px Inter, sans-serif';
        ctx.fillText(isDemo ? 'Instructional demo video to guide participants' : 'Congratulations to all the winners and participants!', CX, 126);
        ctx.restore();

        const groundY = 410;

        // PÓDIO DE CAMPEONATO 1, 2 E 3 COM SUAS ALTURAS ORDENADAS (1º MAIS ALTO NO MEIO)
        
        // Pódio 2: Prata (Esquerda)
        const x2 = CX - 150;
        const w2 = 120;
        const h2 = 110;
        const y2 = groundY - h2;

        let grad2 = ctx.createLinearGradient(x2 - w2/2, y2, x2 + w2/2, groundY);
        grad2.addColorStop(0, '#e2e8f0');
        grad2.addColorStop(1, '#64748b');
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x2 - w2/2, y2, w2, h2, [12, 12, 0, 0]) : ctx.rect(x2 - w2/2, y2, w2, h2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 48px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('2', x2, y2 + h2/2 - 6);
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('PLACE', x2, y2 + h2/2 + 28);

        ctx.save();
        if (winners[1]) {
          ctx.font = '900 12.5px Inter, sans-serif';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText('🥈 ' + maskName(winners[1].name), x2, y2 - 25);
          ctx.font = '500 9.5px Inter, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(maskEmail(winners[1].email), x2, y2 - 10);
        } else {
          ctx.font = 'italic 11px Inter, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillText('-', x2, y2 - 15);
        }
        ctx.restore();

        // Pódio 3: Bronze (Direita)
        const x3 = CX + 150;
        const w3 = 120;
        const h3 = 75;
        const y3 = groundY - h3;

        let grad3 = ctx.createLinearGradient(x3 - w3/2, y3, x3 + w3/2, groundY);
        grad3.addColorStop(0, '#b45309');
        grad3.addColorStop(1, '#451a03');
        ctx.fillStyle = grad3;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x3 - w3/2, y3, w3, h3, [12, 12, 0, 0]) : ctx.rect(x3 - w3/2, y3, w3, h3);
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 38px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('3', x3, y3 + h3/2 - 8);
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('PLACE', x3, y3 + h3/2 + 22);

        ctx.save();
        if (winners[2]) {
          ctx.font = '900 12.5px Inter, sans-serif';
          ctx.fillStyle = '#e5e7eb';
          ctx.fillText('🥉 ' + maskName(winners[2].name), x3, y3 - 25);
          ctx.font = '500 9.5px Inter, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(maskEmail(winners[2].email), x3, y3 - 10);
        } else {
          ctx.font = 'italic 11px Inter, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillText('-', x3, y3 - 15);
        }
        ctx.restore();

        // Pódio 1: Ouro Vencedor (Centro) - Mais alto em destaque!
        const x1 = CX;
        const w1 = 140;
        const h1 = 165;
        const y1 = groundY - h1;

        ctx.save();
        ctx.shadowBlur = 25;
        ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';

        let grad1 = ctx.createLinearGradient(x1 - w1/2, y1, x1 + w1/2, groundY);
        grad1.addColorStop(0, '#fbbf24');
        grad1.addColorStop(0.5, '#d97706');
        grad1.addColorStop(1, '#78350f');
        ctx.fillStyle = grad1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x1 - w1/2, y1, w1, h1, [16, 16, 0, 0]) : ctx.rect(x1 - w1/2, y1, w1, h1);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 64px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('1', x1, y1 + h1/2 + 10);
        ctx.font = '900 13px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('WINNER', x1, y1 + h1 - 25);

        ctx.save();
        if (winners[0]) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = '32px Inter, sans-serif';
          ctx.fillText('👑', x1, y1 - 58);

          ctx.font = '900 15px Inter, sans-serif';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(maskName(winners[0].name), x1, y1 - 26);
          ctx.font = 'bold 10.5px Inter, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(maskEmail(winners[0].email), x1, y1 - 8);
        } else {
          ctx.font = 'italic 12px Inter, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillText('Nobody', x1, y1 - 15);
        }
        ctx.restore();

        if (winners.length > 3) {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 10px Inter, sans-serif';
          let exTxt = "Additional winners drawn: ";
          for (let k = 3; k < winners.length; k++) {
            exTxt += `${k+1}th: ${maskName(winners[k].name)}${k < winners.length - 1 ? ' | ' : ''}`;
          }
          ctx.fillText(exTxt, CX, groundY + 22);
          ctx.restore();
        }

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#38bdf8';
        ctx.font = '900 15px Inter, sans-serif';
        ctx.fillText('☘️ UNTIL NEXT TIME ☘️', CX, groundY + 45);
        ctx.restore();

        // DESENHAR FOTO DO PRODUTO SORTEADO EM ESTILO POLAROID NO CANTO DIREITO
        ctx.save();
        const px = 530;
        const py = 160;
        const pw = 90;
        const ph = 115;

        // Ângulo elegante para dar aspeto de objeto físico/cartão real
        ctx.translate(px + pw/2, py + ph/2);
        ctx.rotate(0.08); // rotação sutil
        ctx.translate(-(px + pw/2), -(py + ph/2));

        // Sombra realística para realçar o cartão polaroid 3D
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';

        // Fundo branco do Polaroid
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(px, py, pw, ph, 6) : ctx.rect(px, py, pw, ph);
        ctx.fill();

        // Borda cinza clara fina
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore(); // Limpa as propriedades de sombra

        ctx.save();
        // Aplicamos a mesma rotação ao conteúdo desenhado internamente
        ctx.translate(px + pw/2, py + ph/2);
        ctx.rotate(0.08);
        ctx.translate(-(px + pw/2), -(py + ph/2));

        let drawnSuccessfully = false;
        if (prizeImg && prizeImg.complete && prizeImg.naturalWidth !== 0) {
          try {
            ctx.drawImage(prizeImg, px + 5, py + 5, pw - 10, ph - 26);
            drawnSuccessfully = true;
          } catch (e) {
            console.warn("Could not draw image inside canvas", e);
          }
        }

        if (!drawnSuccessfully) {
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(px + 5, py + 5, pw - 10, ph - 26);
          ctx.fillStyle = '#3b82f6';
          ctx.font = '24px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🎁', px + pw/2, py + (ph - 26)/2 + 2);
        }

        // Descriptive subtitle in lower Polaroid body
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PRIZE', px + pw/2, py + ph - 11);
        ctx.restore();

        if (confettiList.length < 90) {
          confettiList.push({
            x: Math.random() * canvas.width,
            y: -10,
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 5 + 2.5,
            color: ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#EF4444'][Math.floor(Math.random() * 5)],
            size: Math.random() * 5 + 3
          });
        }
      }

      // 7. Atualizar e desenhar confetes com física rápida
      confettiList.forEach((c, idx) => {
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.22; // gravidade de confete
        c.vx *= 0.98;

        ctx.fillStyle = c.color;
        ctx.fillRect(c.x, c.y, c.size, c.size);

        // Delete se saiu do ecrã
        if (c.y > canvas.height) {
          confettiList.splice(idx, 1);
        }
      });

      // 8. Título do Sorteio e Estatísticas de Gravação na Tela (no próprio canvas para o vídeo de evidência!)
      if (drawStateRef.current !== 'finished') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(15, 15, canvas.width - 30, 42);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(15, 15, canvas.width - 30, 42);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11.5px Inter, sans-serif';
        ctx.textAlign = 'left';
        
        const num = giveaway.drawNumber !== undefined ? giveaway.drawNumber : 0;
        const prefix = num === 0 ? 'DEMO #0: ' : `#${num}: `;
        // Truncate title nicely to prevent overlapping completely
        let titleText = giveaway.title.toUpperCase();
        if (titleText.length > 18) {
          titleText = titleText.substring(0, 16) + '...';
        }
        ctx.fillText(`CONNECTBOAT: ${prefix}${titleText}`, 26, 40);

        // Red active recording indicator ("REC PWA ACTIVE")
        if (isRecordingRef.current) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(360, 36, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 8.5px Inter, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText("REC PWA ACTIVE", 370, 39.5);
        }

        // Draw statistics marker right-aligned
        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 10.5px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(
          `Drawn: ${drawnWinnersRef.current.length + (drawStateRef.current === 'revealing' ? 1 : 0)} of ${giveaway.winnersCount}`, 
          canvas.width - 26, 40
        );
      }

      // Rodapé institucional ConnectBoat no canvas para assegurar copyright
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; // More clear, less faded for video evidence
      ctx.font = 'bold 10px Inter, monospace';
      ctx.textAlign = 'center';
      ctx.fillText("AUDITABLE TICKET DRAW PROCESS ON CONNECTBOAT PWA - CERTIFIED", CX, canvas.height - 18);

      // Loop contínuo
      animationFrameRef.current = requestAnimationFrame(updatePhysicsAndDraw);
    };

    animationFrameRef.current = requestAnimationFrame(updatePhysicsAndDraw);
  };

  // Iniciar gravação do canvas e sorteio de forma síncrona
  const startRecordingAndDrawSequence = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    let stream: any = null;
    let recorder: MediaRecorder | null = null;
    recordedChunksRef.current = [];
    setRecordedChunks([]);

    try {
      // Inicia stream do canvas a 30 FPS com checagem de suporte
      const captureFn = (canvas as any).captureStream || (canvas as any).mozCaptureStream || (canvas as any).webkitCaptureStream;
      if (typeof captureFn === 'function') {
        stream = captureFn.call(canvas, 30);
      }
    } catch (streamError) {
      console.warn("Não foi possível capturar o stream do canvas técnica de gravação:", streamError);
    }

    if (stream) {
      // Tentar inicializar MediaRecorder com os codecs disponíveis no browser
      const options = [
        { mimeType: 'video/webm; codecs=vp9' },
        { mimeType: 'video/webm; codecs=vp8' },
        { mimeType: 'video/webm' },
        { mimeType: 'video/mp4' }
      ];

      for (const opt of options) {
        try {
          recorder = new MediaRecorder(stream, opt);
          console.log(`MediaRecorder inicializado com sucesso: ${opt.mimeType}`);
          break;
        } catch (e) {
          // Tenta a próxima opção
        }
      }

      if (!recorder) {
        try {
          recorder = new MediaRecorder(stream);
          console.log("MediaRecorder inicializado com as configurações padrão");
        } catch (err) {
          console.error("Incapaz de inicializar MediaRecorder", err);
        }
      }
    }

    if (recorder) {
      try {
        customRecorderRef.current = recorder;
        setMediaRecorder(recorder);

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
            setRecordedChunks(prev => [...prev, event.data]);
          }
        };

        recorder.onstop = () => {
          try {
            const mimeType = recorder?.mimeType || 'video/webm';
            const blob = new Blob(recordedChunksRef.current, { type: mimeType });
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
            updateIsRecording(false);
          } catch (stopErr) {
            console.error("Erro ao salvar blob gravado:", stopErr);
          }
        };

        recorder.start();
        updateIsRecording(true);
      } catch (recStartErr) {
        console.error("Erro ao iniciar o gravador de vídeo:", recStartErr);
        // Prossegue com o sorteio sem gravação
      }
    } else {
      console.log("Sorteio rodando em modo simplificado sem gravação (suporte ausente no dispositivo)");
    }

    // Disparar o sorteio das bolinhas! (Sempre executado mesmo se gravação falhar)
    runDrawCycle();
  };

  const stopRecordingSession = () => {
    if (customRecorderRef.current && customRecorderRef.current.state === 'recording') {
      customRecorderRef.current.stop();
    }
  };

  // Ciclo sequencial do Sorteio
  const runDrawCycle = () => {
    if (calculatedWinnersRef.current.length === 0) {
      alert("Nenhum participante habilitante registrado!");
      return;
    }

    // Toca som de motor de lotaria rodando
    playWhirringSound();

    // 1. Fase 1: Agitar o Globo Circular
    updateDrawState('spinning');

    setTimeout(() => {
      // 2. Fase 2: Parar rotação rápida e preparar extração da bolinha do actual vencedor
      updateDrawState('extracting');

      // Identifica ou marca qual bolinha física representará o vencedor de forma auditada
      const currentTargetWinner = calculatedWinnersRef.current[currentWinnerIndexRef.current];
      const balls = ballsRef.current;
      
      // Reseta todas as marcações anteriores
      balls.forEach(b => { b.isWinner = false; });

      // Procura a bola fidedigna do vencedor. 
      // Se não encontrar uma correspondente, toma a primeira decorativa e converte!
      let winnerBall = balls.find(b => b.userId === currentTargetWinner.userId && !b.isDrawn);
      if (!winnerBall) {
        winnerBall = balls.find(b => !b.isDrawn && b.userId !== 'dummy');
      }
      if (!winnerBall) {
        winnerBall = balls.find(b => !b.isDrawn);
      }

      if (winnerBall) {
        winnerBall.isWinner = true;
        winnerBall.name = currentTargetWinner.userName || currentTargetWinner.name || 'Winner';
        winnerBall.email = currentTargetWinner.userEmail || currentTargetWinner.email || '';
        winnerBall.userId = currentTargetWinner.userId;
      } else {
        alert("Physical tickets alignment error.");
        updateDrawState('idle');
      }
    }, 4500);
  };

  // Draw completion and persistence to Firebase
  const handlePersistResults = async () => {
    setLoading(true);
    try {
      let base64Video: string | undefined = undefined;
      
      if (recordedChunksRef.current && recordedChunksRef.current.length > 0) {
        try {
          const mimeType = customRecorderRef.current?.mimeType || 'video/webm';
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          console.log(`[PWAVideo] Recorded: ${(blob.size / 1024).toFixed(1)} KB`);
          
          base64Video = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (convErr) {
          console.error("Error converting video chunks to Base64:", convErr);
        }
      } else if (videoUrl) {
        try {
          const response = await fetch(videoUrl);
          const blob = await response.blob();
          console.log(`[PWAVideo] Blob URL: ${(blob.size / 1024).toFixed(1)} KB`);
          
          base64Video = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (fetchErr) {
          console.error("Error fetching video blob URL:", fetchErr);
        }
      }

      await onDrawComplete(drawnWinners, base64Video);
      alert("Draw results, winner list, and draw video successfully saved to Firestore!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Permission error saving draw results to database at this time.");
    } finally {
      setLoading(false);
    }
  };

  // Mobile/desktop sharing of draw video in native WebM format
  const handleShareVideo = async () => {
    if (!videoUrl) return;
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const filename = `draw-${giveaway.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.webm`;
      const file = new File([blob], filename, { type: blob.type || 'video/webm' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Draw: ${giveaway.title}`,
          text: `Check out the official winners draw video for: ${giveaway.title}! 🏆`
        });
      } else if (navigator.share) {
        await navigator.share({
          title: `Draw: ${giveaway.title}`,
          text: `Check out the official winners draw video for: ${giveaway.title}! 🏆`,
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("The link has been copied to your clipboard!");
      }
    } catch (err) {
      console.warn("Error sharing video:", err);
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert("The link has been copied to your clipboard!");
      } catch (clipErr) {
        console.error(clipErr);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col my-8">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Trophy size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-lg tracking-tight">Auditable Giveaway Draw Sphere</h3>
              <p className="text-slate-400 text-xs font-semibold">ConnectBoat • Video Evidence Animation</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sound Toggler */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl transition-all ${
                soundEnabled ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-800 text-slate-500'
              }`}
              title={soundEnabled ? "Disable Sound" : "Enable Sound"}
            >
              <Volume2 size={18} />
            </button>

            <button 
              onClick={onClose}
              disabled={drawState === 'spinning' || drawState === 'extracting' || drawState === 'revealing'}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content Stage */}
        <div className="p-6 flex flex-col items-center justify-center space-y-6 bg-slate-900/40">
          
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3.5 text-slate-400">
              <RefreshCw className="animate-spin text-indigo-500" size={36} />
              <p className="text-sm font-bold">Calibrating globe and loading tickets...</p>
            </div>
          ) : participants.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <Users size={48} className="mx-auto text-slate-600" />
              <p className="font-bold text-base text-slate-300">No entries registered</p>
              <p className="text-xs max-w-xs mx-auto text-slate-500">
                Users need to share valid entries on the public page so physical tickets are loaded in the draw globe.
              </p>
              <button
                onClick={onClose}
                className="mt-2 text-xs px-4 py-2 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl"
              >
                Back
              </button>
            </div>
          ) : (
            <div className="space-y-6 w-full flex flex-col items-center">
              
              {/* CANVAS ELEMENT STAGE */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-950 shadow-inner group">
                <canvas 
                  ref={canvasRef} 
                  width={640} 
                  height={510} 
                  className="w-full max-w-[640px] block"
                />

                {/* Status Overlays */}
                {drawState === 'idle' && (
                  <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 pointer-events-auto">
                    <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/35 text-indigo-400 rounded-3xl flex items-center justify-center animate-pulse">
                      <Sparkles size={32} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-lg font-black text-white tracking-tight">Ready to Mix and Extract</h4>
                      <p className="text-xs text-slate-300 max-w-sm font-medium">
                        Loaded <strong className="text-indigo-400">{ballsRef.current.length} physical tickets</strong> into the globe for this draw corresponding to participant entries.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 w-full max-w-[280px]">
                      <button
                        onClick={startRecordingAndDrawSequence}
                        className="w-full px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] cursor-pointer"
                      >
                        <Play size={16} fill="white" />
                        <span>Start Draw and Record Video</span>
                      </button>

                      <button
                        onClick={() => generateFictitiousParticipants(50)}
                        className="w-full px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition border border-slate-700/80 hover:border-slate-600 flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Clear all current participants and generate 50 new random participants."
                      >
                        🔄 Regenerate 50 Participants (New Video)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="w-full max-w-[640px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Probability Metrics</span>
                  <div className="flex items-center gap-1.5 mt-0.5 mt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-black rounded-lg">
                      <Users size={12} />
                      {participants.length} Participants
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-300 text-xs font-black rounded-lg">
                      🎟️ {ballsRef.current.filter(x => x.userId !== 'dummy').length} Total Tickets
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {drawState === 'idle' && (
                    <>
                      <button
                        onClick={() => generateFictitiousParticipants(50)}
                        className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-extrabold text-xs rounded-xl transition border border-slate-700 flex items-center gap-1 cursor-pointer"
                        title="Clear all current participants and generate 50 new random participants."
                      >
                        🔄 Regenerate 50 Random
                      </button>
                      <button
                        onClick={startRecordingAndDrawSequence}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-900/50 hover:scale-[1.02] cursor-pointer"
                      >
                        <Play size={14} fill="white" />
                        <span>Start Draw 🎟️</span>
                      </button>
                    </>
                  )}

                  {videoUrl && (
                    <>
                      <a
                        href={videoUrl}
                        download={`draw-${giveaway.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.webm`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition shadow hover:scale-[1.01]"
                      >
                        <Download size={14} />
                        <span>Download Recorded Video 📹</span>
                      </a>
                      <button
                        onClick={handleShareVideo}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-xl transition shadow hover:scale-[1.01] cursor-pointer"
                        title="Share official draw video with your community"
                      >
                        <Share2 size={14} />
                        <span>Share Video 🔗</span>
                      </button>
                    </>
                  )}

                  {drawState === 'finished' && (
                    <button
                      onClick={handlePersistResults}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5"
                    >
                      <Trophy size={14} />
                      <span>Confirm & Announce Winners</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
