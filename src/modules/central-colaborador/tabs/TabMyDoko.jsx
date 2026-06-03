import React, { useState, useEffect, useRef } from 'react';
import { T } from '../../../contexts/theme';
import { USER, SERVER_URL, supabase as _supabase } from '../../../contexts/user';
import { Card, StarDivider, SHead } from '../../../shared/components';
import dokoTecnico      from '../../../assets/DodocoTecnico.jpg';
import dokoCozinheiro   from '../../../assets/DodocoCozinheiro.jpg';
import dokoMedico       from '../../../assets/DodocoMedico.jpg';
import dokoAmbiental    from '../../../assets/DodocoAmbientalista.jpg';
import dokoContador     from '../../../assets/DodocoContador.jpg';
import dokoTecnicoCansado     from '../../../assets/DodocoTecnicoCansado.jpg';
import dokoCozinheiroCansado  from '../../../assets/DodocoCozinheiroCansado.jpg';
import dokoMedicoCansado      from '../../../assets/DodocoMedicoCansado.jpg';
import dokoAmbientalCansado   from '../../../assets/DodocoAmbientalistaCansada.jpg';
import dokoContadorCansado    from '../../../assets/DodocoContadorCansado.jpg';

import UnikoWaveImg      from '../../../assets/UnikoWave.png';
import UnikoKpopImg      from '../../../assets/UnikoKPOP.png';
import UnikoMPBImg       from '../../../assets/UnikoMPB.png';
import UnikoRockImg      from '../../../assets/UnikoRock.png';
import UnikoRapImg       from '../../../assets/UnikoRap.png';
import UnikoPopImg       from '../../../assets/UnikoPop.png';
import UnikoCowboyImg    from '../../../assets/UnikoCowboy.png';
import UnikoGospelImg    from '../../../assets/UnikoGospel.png';
import UnikoColumbinaImg from '../../../assets/UnikoColumbina.png';

// XP total acumulado necessário para atingir cada nível (índice = nível)
const XP_LEVELS = [0, 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

// Unikos comuns desbloqueados por nível (raridade Comum)
const UNIKO_COMMON = [
  { level:2,  key:'pop',       name:'UnikoPop',       title:'Voz da Multidão',       img:UnikoPopImg       },
  { level:3,  key:'kpop',      name:'UnikoKpop',      title:'Stan Supremo',           img:UnikoKpopImg      },
  { level:4,  key:'mpb',       name:'UnikoMPB',       title:'DJ da Alma Brasileira',  img:UnikoMPBImg       },
  { level:5,  key:'rock',      name:'UnikoRock',      title:'DJ Rita Lee',            img:UnikoRockImg      },
  { level:6,  key:'rap',       name:'UnikoRap',       title:'True Damage DJ',         img:UnikoRapImg       },
  { level:7,  key:'cowboy',    name:'UnikoCowboy',    title:'DJ da Sofrência',        img:UnikoCowboyImg    },
  { level:8,  key:'gospel',    name:'UnikoGospel',    title:'DJ da Fé',              img:UnikoGospelImg    },
  { level:9,  key:'columbina', name:'UnikoColumbina', title:'Deusa da Lua',           img:UnikoColumbinaImg },
  { level:10, key:'wave',      name:'UnikoWave',      title:'DJ da 7 Benefícios',    img:UnikoWaveImg      },
];

const xpToLevel = xp => {
  let lv = 1;
  for (let i = XP_LEVELS.length - 1; i >= 2; i--) {
    if (xp >= XP_LEVELS[i]) { lv = i; break; }
  }
  return Math.min(lv, XP_LEVELS.length - 1);
};

const DOKO_SKINS = [
  {id:'tecnico',    label:'Técnico',       img:dokoTecnico,    imgCansado:dokoTecnicoCansado,    color:'#2E8DD4'},
  {id:'cozinheiro', label:'Cozinheiro',    img:dokoCozinheiro, imgCansado:dokoCozinheiroCansado, color:'#E05030'},
  {id:'medico',     label:'Médico',        img:dokoMedico,     imgCansado:dokoMedicoCansado,     color:'#D03030'},
  {id:'ambiental',  label:'Ambientalista', img:dokoAmbiental,  imgCansado:dokoAmbientalCansado,  color:'#28A870'},
  {id:'contador',   label:'Contador',      img:dokoContador,   imgCansado:dokoContadorCansado,   color:'#1A7A50'},
];

const DOKO_PERSONALIDADES = {
  /* ─── TÉCNICO — foco em TI: internet, notebook, OneDrive, arquivos ─── */
  tecnico: {
    saudacao: ['Sistemas verificados! Tudo online?','Conexão estabelecida! Como está o seu notebook hoje?','Olá! OneDrive sincronizado?'],
    feed:     ['Energia recebida! Bateria do notebook também carregando?','Combustível aceito! Lembra de salvar o Excel antes de fechar!','Recarregado! Como está a velocidade da internet hoje?'],
    pet:      ['Carinho recebido! Melhor que reiniciar o roteador!','Ahh! Um ctrl+Z na vida real!','Isso sim resolve qualquer problema de conexão!'],
    feliz:    ['Internet estável, OneDrive sincronizado, tudo certo!','Status: verde em todos os sistemas!','Notebook funcionando perfeitamente hoje!'],
    neutro:   ['Hmm... latência alta. Preciso de atenção!','Sinal fraco por aqui. Me da uma força?','Disco quase cheio... falta espaço pra sorrir.'],
    triste:   ['Sem sinal! Estou desconectado!','404: atenção não encontrada!','OneDrive parou de sincronizar... e eu também.'],
    dicas: [
      'Salvou o Excel hoje? Ctrl+S a cada 5 minutos evita muito sofrimento!',
      'OneDrive sincronizando? Verifique o ícone na bandeja do sistema.',
      'Internet lenta? Tente reiniciar o roteador: 30 segundos desligado.',
      'Notebook aquecendo? Limpe a ventoinha e use em superfícies firmes.',
      'Backup em dia? Pelo menos uma cópia na nuvem e uma local.',
      'Feche abas desnecessárias do navegador. Cada aba consome RAM.',
      'Windows Update pendente? Atualize fora do horário de trabalho.',
      'Senha fraca é porta aberta. Use ao menos 12 caracteres misturados.',
      'Câmera ou microfone com problema? Verifique o Gerenciador de Dispositivos.',
      'Espaço em disco abaixo de 10%? Hora de limpar a lixeira e temporários.',
    ],
    conversa: [
      { pergunta: 'Como está a internet por aí hoje?',
        opcoes: [
          {t:'Voando! Sem problemas',   r:'Que alívio! Aproveite enquanto dura!',
            proximo:{pergunta:'Está usando o OneDrive para os seus arquivos?',opcoes:[
              {t:'Sim, tudo sincronizando!', r:'Perfeito! Seus arquivos estão seguros na nuvem. Continue assim!', proximo:null},
              {t:'Estava com problema',      r:'Tente desconectar e reconectar a conta do OneDrive nas configurações.', proximo:null},
              {t:'Não uso muito',            r:'Recomendo! É a melhor proteção contra perda de arquivos.', proximo:null},
            ]}},
          {t:'Instável, cai às vezes',  r:'Clássico! Tente reiniciar o roteador e verificar o cabo.',
            proximo:{pergunta:'Usa Wi-Fi ou cabo de rede?',opcoes:[
              {t:'Wi-Fi',  r:'Wi-Fi é prático mas cabo garante mais estabilidade. Vale o teste!', proximo:null},
              {t:'Cabo',   r:'Com cabo e ainda instável, o problema pode ser no provedor. Abra um chamado!', proximo:null},
              {t:'Ambos',  r:'No cabo e ainda cai? Provável falha no provedor ou no modem mesmo.', proximo:null},
            ]}},
          {t:'Sem internet hoje',        r:'Situação crítica! Reinicie o roteador, verifique o cabo e ligue para a operadora.',
            proximo:{pergunta:'Já tentou reiniciar o modem?',opcoes:[
              {t:'Sim, não resolveu',    r:'Então é com a operadora mesmo. Acione o suporte deles!', proximo:null},
              {t:'Ainda não',            r:'Desligue por 30 segundos e ligue novamente. Resolve 80% dos casos!', proximo:null},
            ]}},
          {t:'Melhorou hoje!',           r:'Que ótimo! Mudança de canal do Wi-Fi ou reinício resolveu?',
            proximo:{pergunta:'O que fez para melhorar?',opcoes:[
              {t:'Reiniciei o roteador',  r:'Clássico e eficiente! Guarda essa dica para sempre.', proximo:null},
              {t:'Mudei o canal do Wi-Fi',r:'Avançado! Canais menos congestionados fazem diferença.', proximo:null},
              {t:'Sozinho melhorou',      r:'Às vezes é só instabilidade do provedor mesmo. Bom que voltou!', proximo:null},
            ]}},
        ]},
      { pergunta: 'Como está o desempenho do seu notebook?',
        opcoes: [
          {t:'Rápido, sem reclamações!', r:'Que bom! Lembra de reiniciar pelo menos uma vez por semana.',
            proximo:{pergunta:'Quantas abas de navegador costuma ter abertas?',opcoes:[
              {t:'Menos de 10',   r:'Excelente disciplina! Seu notebook agradece.', proximo:null},
              {t:'De 10 a 20',    r:'Razoável, mas feche as que não usa. RAM é recurso precioso!', proximo:null},
              {t:'Mais de 20...',  r:'Isso explica qualquer lentidão! Feche umas abas agora!', proximo:null},
            ]}},
          {t:'Um pouco lento hoje',      r:'Verifique o gerenciador de tarefas. Algo pode estar consumindo CPU ou RAM.',
            proximo:{pergunta:'Quantos programas abertos ao mesmo tempo?',opcoes:[
              {t:'Poucos, abri agora',    r:'Pode ser atualização em segundo plano. Aguarde um pouco.', proximo:null},
              {t:'Muitos ao mesmo tempo', r:'Feche o que não usa! Menos programas = mais velocidade.', proximo:null},
              {t:'Reiniciando agora',     r:'Ótima ideia! Reiniciar limpa a memória. Bom caminho!', proximo:null},
            ]}},
          {t:'Travando bastante',         r:'Urgente! Verifique espaço em disco e memória RAM disponível.',
            proximo:{pergunta:'Há quanto tempo não reinicia o computador?',opcoes:[
              {t:'Reiniciei hoje',        r:'Hmm, então pode ser vírus ou disco com problema. Rode um antivírus!', proximo:null},
              {t:'Faz alguns dias',       r:'Reinicia agora! Acúmulo de processos em memória causa isso.', proximo:null},
              {t:'Faz semanas...',        r:'Semanas sem reiniciar! Isso é o problema. Reinicia agora!', proximo:null},
            ]}},
          {t:'Bateria acabando rápido',   r:'Verifique o estado da bateria em Configurações > Sistema.',
            proximo:{pergunta:'Com quantos % a bateria mostra "crítico"?',opcoes:[
              {t:'Abaixo de 20%',         r:'Normal. Mas se chega a 0% rápido demais, a bateria pode estar degradada.', proximo:null},
              {t:'Já começa fraca',       r:'Bateria velha ou configuração de energia muito agressiva. Ajuste o plano!', proximo:null},
              {t:'Sumiu de 100 pra 30%',  r:'Bateria com defeito. Verifique a garantia do equipamento!', proximo:null},
            ]}},
        ]},
      { pergunta: 'Seus arquivos estão salvos e seguros hoje?',
        opcoes: [
          {t:'Sim, tudo no OneDrive!',    r:'Perfeito! Arquivos na nuvem é segurança máxima.',
            proximo:{pergunta:'Última sincronização foi recente?',opcoes:[
              {t:'Sim, agora mesmo',       r:'Excelente! Pode trabalhar tranquilo!', proximo:null},
              {t:'Não sei verificar',      r:'Olha o ícone de nuvem na barra de tarefas. Verde = sincronizado!', proximo:null},
              {t:'Estava com erro',        r:'Clica com o botão direito no ícone do OneDrive e vê o que diz.', proximo:null},
            ]}},
          {t:'Salvei localmente só',       r:'Risco! Um defeito no HD e tudo se perde. Suba para a nuvem agora!',
            proximo:{pergunta:'Quer ajuda para configurar o OneDrive?',opcoes:[
              {t:'Sim, como faço?',         r:'Pesquisa "OneDrive configurar conta" no suporte Microsoft. É simples!', proximo:null},
              {t:'Já sei, só fui preguiçoso',r:'Rsrs! Vai lá fazer agora. Prevenção vale mais que recuperação!', proximo:null},
              {t:'Prefiro HD externo',      r:'HD externo é ótimo! Só não esqueça de conectar todo dia.', proximo:null},
            ]}},
          {t:'Esqueci de salvar o Excel!', r:'Ctrl+S agora! Corre! Depois ativa o salvamento automático nas opções!',
            proximo:{pergunta:'Já ativou o salvamento automático do Office?',opcoes:[
              {t:'Sim, já está ativo!',     r:'Ótimo! Mas Ctrl+S manual de vez em quando não faz mal.', proximo:null},
              {t:'Não sei onde fica',       r:'No Excel: Arquivo > Opções > Salvar > ativar "Salvar automaticamente"!', proximo:null},
              {t:'Vou ativar agora!',       r:'Excelente decisão! Isso vai te salvar de muita dor de cabeça!', proximo:null},
            ]}},
          {t:'Nem sei onde estão...',      r:'Situação crítica! Usa o Explorador de Arquivos e pesquisa por data de modificação.',
            proximo:{pergunta:'Os arquivos são de trabalho importantes?',opcoes:[
              {t:'Sim, muito importantes',  r:'Ativa o OneDrive agora e move tudo pra lá! Urgente!', proximo:null},
              {t:'São pessoais',            r:'Mesmo assim, organize uma pasta padrão. Facilita tudo!', proximo:null},
              {t:'Já achei, valeu!',        r:'Que alívio! Agora cria uma rotina de organização!', proximo:null},
            ]}},
        ]},
    ],
    conclusao:'Conversamos muito hoje! Você é incrível. Descanse e volte logo!',

    alertaFome:    'Processador em modo de alerta: preciso de combustível!',
    alertaEnergia: 'Bateria crítica! Preciso recarregar urgente!',
    alertaSono:    'Sistema operando há muito tempo... modo sleep necessário!',
    dormindo: ['Entrando em modo standby... zzz...','Desligando temporariamente...','Hibernando sistema...'],
    acordando: ['Boot completo! Pronto para o dia!','Sistemas reiniciados! Bom dia!','Acordado e atualizado!'],  },

  /* ─── COZINHEIRO ─── */
  cozinheiro: {
    saudacao: ['Que fome de te ver! Seja bem-vindo!','A cozinha está pronta, e você?','Que alegria! Vamos cozinhar um dia incrível!'],
    feed:     ['Delicioso! Adoro quando me alimentam!','Hmm, que sabor maravilhoso!','Obrigado! Tô cheinho de energia agora!'],
    pet:      ['Ahh, doce como um suspiro!','Que carinho quentinho!','Melhor do que chocolate quente!'],
    feliz:    ['Tudo temperado na medida certa!','O prato do dia está divino!'],
    neutro:   ['Hmm, faltou um tempero hoje...','O caldo está morno. Me anima!'],
    triste:   ['A panela está vazia e meu coração também!','Sem ingredientes... tô na saudade!'],
    dicas: [
      'Já tomou café da manhã? O dia começa melhor com energia de manhã!',
      'Frutas e oleaginosas são ótimas para manter o foco. Tente!',
      'Almoço é sagrado. Para tudo e vai comer com calma!',
      'Comida feita em casa tem mais amor e menos sódio!',
      'Um chá quente depois do almoço faz maravilhas para o sistema.',
      'Proteína no café da manhã reduz ansiedade ao longo do dia.',
      'Evite açúcar em excesso — energia rápida que cai igual torta.',
      'Beber água antes das refeições melhora a digestão.',
      'O intestino é o segundo cérebro. Cuide do que você coloca nele!',
    ],
    conversa: [
      { pergunta: 'Qual o sabor do seu dia hoje?',
        opcoes: [
          {t:'Delicioso! Mel e canela 🍯',  r:'Que receita perfeita! Continue assim!',
            proximo:{pergunta:'Você se alimentou bem hoje?',opcoes:[
              {t:'Sim, três refeições!',   r:'Perfeito! Corpo nutrido, mente afiada. Você sabe viver!', proximo:null},
              {t:'Almoço só',              r:'Adiciona um lanchinho da tarde. Sua energia vai agradecer!', proximo:null},
              {t:'Fui de delivery',        r:'Tudo bem! O importante é se nutrir. Tente cozinhar amanhã?', proximo:null},
            ]}},
          {t:'Temperado, mas saboroso',     r:'Um pouco picante é bom! Você arrasou!',
            proximo:{pergunta:'O que foi o ingrediente mais difícil hoje?',opcoes:[
              {t:'Uma tarefa complicada',   r:'Desafios dão sabor à vida. Você temperou bem!', proximo:null},
              {t:'Uma conversa difícil',    r:'Comunicação é uma receita com muitos ajustes. Parabéns pela coragem!', proximo:null},
              {t:'Falta de tempo',          r:'Preparo rápido também alimenta! Você fez o possível.', proximo:null},
            ]}},
          {t:'Sem sal, meio sem graça',     r:'Vamos temperar esse dia! Amanhã começa nova receita.',
            proximo:{pergunta:'O que falta para melhorar o sabor?',opcoes:[
              {t:'Uma pausa para respirar', r:'Isso! Descanso é o fermento da vida. Imprescindível!', proximo:null},
              {t:'Uma conversa boa',        r:'Boa companhia é o melhor tempero. Chame alguém!', proximo:null},
              {t:'Só passa o dia',          r:'Às vezes a receita demora. Confie no processo!', proximo:null},
            ]}},
          {t:'Amargo, foi muito difícil',   r:'Até o café amargo tem seu charme. Vai passar!',
            proximo:{pergunta:'Quer um ingrediente secreto para melhorar?',opcoes:[
              {t:'Sim! Qual é?',            r:'Uma coisa que você gosta antes de dormir. Recompensa é essencial!', proximo:null},
              {t:'Preciso descansar',       r:'Sábio! Repouso é parte da receita. Dorme bem!', proximo:null},
              {t:'Só quero que acabe',      r:'Coragem! Todo prato difícil vira experiência de chef.', proximo:null},
            ]}},
        ]},
    ],
    conclusao:'Sessão encerrada! Você foi muito bem. Cuide-se e até a próxima consulta!',

    alertaFome:    'Minha barriga está roncando na cozinha!',
    alertaEnergia: 'O fogão apagou... sem energia aqui!',
    alertaSono:    'Os olhos estão fechando sozinhos...',
    dormindo: ['Hora de descansar o fogão e eu também... zzz...','Guardando o avental. Boa noite!','Sonhos deliciosos chegando...'],
    acordando: ['Bom dia! Já pensei no cardápio de hoje!','Acordei com fome de viver!','Pronto para uma nova receita!'],  },

  /* ─── MÉDICO ─── */
  medico: {
    saudacao: ['Consulta iniciada! Como posso ajudar?','Dr. Doko à disposição! Tudo bem?','Diagnóstico do dia: você chegou! Que ótimo!'],
    feed:     ['Prescrição de comida aceita!','Nutrientes recebidos! Saúde em dia!','Dose diária de energia administrada!'],
    pet:      ['Terapia de carinho aplicada com sucesso!','Oxitocina liberada! Que bom!','Tratamento afetivo em andamento!'],
    feliz:    ['Todos os indicadores vitais ótimos!','Check-up perfeito hoje!'],
    neutro:   ['Alguns sintomas de cansaço detectados...','Precisando de atenção médica — a minha!'],
    triste:   ['Situação crítica! Preciso de socorro!','Baixo nível de energia detectado!'],
    dicas: [
      'Dormiu menos de 7 horas? Seu sistema imunológico fica comprometido.',
      'Saúde mental importa tanto quanto física. Como está sua cabeça hoje?',
      'Faça pelo menos 30 min de caminhada hoje. Prescrição médica!',
      'Tela antes de dormir atrapalha o sono. Desligue 30 min antes.',
      'Já fez seu exame anual? Prevenção é o melhor remédio.',
      'Ansiedade alta? Respire: 4s inhale, 7s segure, 8s expire.',
      'Hidrate-se! 35ml de água por kg corporal por dia é o mínimo.',
      'Exercício físico libera endorfina — o antidepressivo natural gratuito.',
      'Dor nas costas? Se você fica muito tempo sentado, levante-se agora.',
      'Uma alimentação colorida garante variedade de nutrientes!',
    ],
    conversa: [
      { pergunta: 'Como está sua saúde mental hoje?',
        opcoes: [
          {t:'Excelente, me sinto leve!',    r:'Diagnóstico: saudável! Continue assim!',
            proximo:{pergunta:'Está praticando alguma atividade física?',opcoes:[
              {t:'Sim, regularmente!',        r:'Perfeito! Exercício é o melhor remédio preventivo. Parabéns!', proximo:null},
              {t:'De vez em quando',          r:'Tente tornar regular! Até 20 min por dia já faz diferença.', proximo:null},
              {t:'Não pratico',               r:'Prescrevo: comece com uma caminhada de 15 min amanhã!', proximo:null},
            ]}},
          {t:'Bem, só um pouco cansado',     r:'Normal! O corpo pede descanso às vezes.',
            proximo:{pergunta:'Dormiu quantas horas esta semana?',opcoes:[
              {t:'7 a 9 horas por noite',     r:'Sono ideal! Continue essa rotina saudável.', proximo:null},
              {t:'Entre 5 e 7 horas',         r:'Limite aceitável, mas tente melhorar. Durma 30 min antes.', proximo:null},
              {t:'Menos de 5 horas',          r:'Alerta médico! Privação de sono prejudica tudo. Priorize dormir!', proximo:null},
            ]}},
          {t:'Estressado, muita pressão',    r:'Sinto muito. Tente respirar fundo 3x agora.',
            proximo:{pergunta:'Identificou a causa do estresse?',opcoes:[
              {t:'Trabalho em excesso',        r:'Defina horário de desligar. Limites são saudáveis!', proximo:null},
              {t:'Problemas pessoais',         r:'Cuide disso com atenção. Considere conversar com alguém de confiança.', proximo:null},
              {t:'Não sei identificar',        r:'Vale um diário de emoções. Ajuda a mapear o que te afeta.', proximo:null},
            ]}},
          {t:'Ansioso com tudo',             r:'Você não está sozinho. Um passo de cada vez!',
            proximo:{pergunta:'Você tem uma rotina noturna para relaxar?',opcoes:[
              {t:'Sim, funciona bem!',         r:'Ótimo! Rotinas são âncoras para o sistema nervoso.', proximo:null},
              {t:'Não tenho nenhuma',          r:'Experimente: banho morno, sem tela, leitura leve. Simples e eficaz!', proximo:null},
              {t:'Tento mas não consigo',      r:'Meditação guiada pode ajudar. 5 minutinhos antes de dormir!', proximo:null},
            ]}},
        ]},
      { pergunta: 'Cuidou bem de você hoje?',
        opcoes: [
          {t:'Sim! Água, comida e pausa',    r:'Paciente exemplar! Esse é o tratamento certo.',
            proximo:{pergunta:'Tem feito check-ups médicos regularmente?',opcoes:[
              {t:'Sim, estou em dia!',         r:'Prevenção é o melhor remédio. Continue assim!', proximo:null},
              {t:'Faz tempo que não vou',      r:'Marque uma consulta esta semana! Exames de rotina salvam vidas.', proximo:null},
              {t:'Tenho medo de ir ao médico', r:'Entendo. Mas o medo de saber é menor que o custo de não saber!', proximo:null},
            ]}},
          {t:'Mais ou menos, fui descuidado', r:'Reconhecer é o primeiro passo! Hidrate-se agora.',
            proximo:{pergunta:'O que negligenciou hoje?',opcoes:[
              {t:'Esqueci de comer direito',   r:'Alimentação é base! Corrija agora e planeje amanhã melhor.', proximo:null},
              {t:'Fiquei sem água',            r:'Beba um copo agora! Desidratação leve já reduz o foco em 20%.', proximo:null},
              {t:'Não descansei nada',         r:'Micro pausas de 5 min a cada hora fazem diferença enorme!', proximo:null},
            ]}},
          {t:'Honestamente, não muito',       r:'Cuide-se! Você não pode ajudar ninguém no limite.',
            proximo:{pergunta:'Qual é a principal dificuldade?',opcoes:[
              {t:'Falta de tempo',             r:'Autocuidado de 15 min vale mais que nada. Priorize!', proximo:null},
              {t:'Sempre coloco os outros na frente',r:'Nobre, mas insustentável. Cuide de você para cuidar melhor deles!', proximo:null},
              {t:'Não sei por onde começar',   r:'Comece pela água: beba um copo agora. Depois veja o próximo passo.', proximo:null},
            ]}},
        ]},
    ],
    conclusao:'Ciclo de perguntas completo. Você demonstrou consciência. Até o próximo ciclo.',

    alertaFome:    'Hipoglicemia detectada! Preciso me alimentar!',
    alertaEnergia: 'Sinais vitais de energia em queda!',
    alertaSono:    'Privação de sono detectada! Hora de descansar!',
    dormindo: ['Encerrando plantão... boa noite...','Prescrevo uma boa noite de sono para nós dois!','Descanso médico iniciado...'],
    acordando: ['Plantão reiniciado! Bom dia!','Sinais vitais normalizados após o sono!','Descansado e pronto para cuidar!'],  },

  /* ─── AMBIENTALISTA ─── */
  ambiental: {
    saudacao: ['...Você chegou. Bom.','O ecossistema precisa de equilíbrio. E você?','Hmm. Mais um humano. Espero que traga boas energias.'],
    feed:     ['...Aceitável. Obrigado.','Combustível renovável recebido.','A natureza provê. E você também. Grato.'],
    pet:      ['...Isso. Equilíbrio restaurado.','Energia positiva transferida. Bem melhor.','Hmm. Tá bom, adorei. Pode continuar.'],
    feliz:    ['Ecossistema em equilíbrio. Satisfatório.','A floresta está em paz. Eu também.'],
    neutro:   ['Hmm. Poderia estar melhor. Assim como o planeta.','Recursos energéticos em queda...'],
    triste:   ['Desequilíbrio total. Emergência ambiental aqui!','Seco. Vazio. Como um deserto.'],
    dicas: [
      'Uma caminhada ao ar livre hoje. Reconectar com a natureza não é luxo.',
      'Você desligou aparelhos em standby? Cada watt conta.',
      'Respira fundo. O ar ainda é de graça. Aproveite.',
      'Quanto tempo de tela hoje? A natureza não tem notificações.',
      'Plante algo, mesmo que seja no vaso. Vida chama vida.',
      'Reduza o desperdício de comida hoje. É ético e sábio.',
      'Uma hora longe do celular por dia. O mundo não vai acabar — talvez melhore.',
      'Seu ritmo circadiano agradece quando você dorme e acorda no mesmo horário.',
      'Gratidão pelo que já tem. É o consumo mais sustentável que existe.',
    ],
    conversa: [
      { pergunta: 'Como foi o impacto do seu dia?',
        opcoes: [
          {t:'Sustentável! Aproveitei bem',    r:'Hmm. Impacto positivo. Isso é raro. Parabéns.',
            proximo:{pergunta:'Fez algo pelo meio ambiente hoje?',opcoes:[
              {t:'Reduzi o consumo de plástico', r:'Bom. Cada peça de plástico evitada importa. Continue.', proximo:null},
              {t:'Economizei água e energia',     r:'Excelente gestão de recursos. O planeta notou.', proximo:null},
              {t:'Só vivi conscientemente',       r:'...Já é mais do que a maioria. Respeito.', proximo:null},
            ]}},
          {t:'Reciclando energias, devagar',   r:'Conservação é sábia. Continue nesse ritmo.',
            proximo:{pergunta:'O que está pesando em você?',opcoes:[
              {t:'Trabalho acumulado',            r:'Trabalho não some. Mas você pode precisar de uma pausa na floresta.', proximo:null},
              {t:'Notícias ruins do mundo',       r:'...O mundo tem problemas. Mas você está aqui, agindo. Isso conta.', proximo:null},
              {t:'Cansaço geral',                 r:'Até os rios precisam de estação seca. Descanse sem culpa.', proximo:null},
            ]}},
          {t:'Consumindo muita energia...',    r:'Atenção. Todo recurso tem limite. Cuide-se.',
            proximo:{pergunta:'Consegue identificar o maior gasto de energia?',opcoes:[
              {t:'Reuniões e pessoas difíceis',   r:'Relações são ecossistemas. Algumas drenam, outras nutrem.', proximo:null},
              {t:'Preocupações que não controlo', r:'Foca no que está no seu raio de ação. O resto, deixa fluir.', proximo:null},
              {t:'Estou sobrecarregado mesmo',    r:'Desligamento preventivo necessário. Priorize agora.', proximo:null},
            ]}},
          {t:'Esgotei tudo hoje',              r:'...Precisa de reflorestamento urgente. Descanse.',
            proximo:{pergunta:'Quando foi a última vez que fez algo só para você?',opcoes:[
              {t:'Hoje mesmo!',                   r:'Ótimo. Continue assim. Autocuidado é sustentabilidade humana.', proximo:null},
              {t:'Faz alguns dias',               r:'Já passou da hora. Amanhã coloca algo no calendário.', proximo:null},
              {t:'Não me lembro...',              r:'...Isso é preocupante. Você importa tanto quanto qualquer causa.', proximo:null},
            ]}},
        ]},
    ],
  },

  /* ─── CONTADOR — foco em finanças, IR, contabilidade ─── */
  contador: {
    saudacao: ['Planilhas abertas! Vamos calcular?','Contador Doko em campo! Lançamentos em dia?','Balanço iniciando! Como posso ajudar?'],
    feed:     ['Receita contabilizada no ativo!','Entrada lançada! Saldo positivo!','Combustível registrado. Dedutível, claro!'],
    pet:      ['Carinho lançado como receita extraordinária!','Isso é um ativo não-monetário valioso!','Balanço emocional: positivo!'],
    feliz:    ['Todos os lançamentos conferindo!','Balanço equilibrado hoje!','Fechamento sem pendências!'],
    neutro:   ['Hmm, alguns lançamentos pendentes...','Preciso fechar o mês. Me ajuda?','Divergência encontrada... precisando de atenção.'],
    triste:   ['Saldo zerado! Precisando de reforço!','Balanço negativo aqui!','Deficit emocional detectado!'],
    dicas: [
      'Valor bruto é o total antes dos descontos. Líquido é o que você recebe de fato.',
      'IR 2024: isenção para rendimentos até R$ 2.824,00/mês.',
      'Taxa administrativa é o custo de gestão de um serviço — não é imposto!',
      'Ressarcimento: reembolso de despesa que você pagou por outra pessoa.',
      'Devolução: retorno de valor pago indevidamente. São conceitos diferentes!',
      'Valor de repasse = bruto menos taxas e deduções. É o que chega ao destinatário.',
      'INSS varia de 7,5% a 14% conforme a faixa salarial. Verifique a sua!',
      'Guarde recibos de despesas dedutíveis no IR: saúde, educação, previdência.',
      'Alíquota máxima do IR pessoa física: 27,5% acima de R$ 4.664,68/mês.',
      'Para calcular 15%: divida o valor por 10 e some a metade. Ex: 3.200 ÷ 10 = 320, + 160 = 480.',
    ],
    conversa: [
      { pergunta: 'O que é Valor Bruto?',
        opcoes: [
          {t:'O total antes de qualquer desconto',   r:'Exato! Bruto é o valor completo antes de impostos, taxas ou deduções.',
            proximo:{pergunta:'E o Valor Líquido é:',opcoes:[
              {t:'O valor após todos os descontos',  r:'Perfeito! Líquido = bruto − todos os descontos. É o que entra na conta!', proximo:null},
              {t:'O valor do produto sem IPI',       r:'Não exatamente. Líquido abrange TODOS os descontos, não só o IPI.', proximo:null},
              {t:'O mesmo que valor de mercado',     r:'Não! Líquido é o bruto menos os descontos aplicados. É o valor final recebido.', proximo:null},
            ]}},
          {t:'O valor após os impostos',             r:'Esse seria o Líquido! Bruto é o total ANTES de qualquer desconto.',proximo:null},
          {t:'O valor do lucro',                     r:'Não confunda! Bruto é o faturado antes dos descontos. Lucro é outra conta.',proximo:null},
          {t:'Não tenho certeza',                    r:'Bruto = total sem nenhum desconto aplicado. Anota aí!',proximo:null},
        ]},
      { pergunta: 'Sobre IR: qual faixa está isenta em 2024?',
        opcoes: [
          {t:'Até R$ 2.824,00/mês',                 r:'Correto! Rendimentos até R$ 2.824,00/mês são isentos na tabela progressiva.',
            proximo:{pergunta:'A alíquota máxima do IR pessoa física é:',opcoes:[
              {t:'27,5%',                            r:'Isso! 27,5% para rendimentos acima de R$ 4.664,68/mês. Guarda esse número!', proximo:null},
              {t:'35%',                              r:'No Brasil o teto é 27,5%, não 35%. Atenção na declaração!', proximo:null},
              {t:'15%',                              r:'15% é intermediário. O teto máximo do IR pessoa física é 27,5%.', proximo:null},
            ]}},
          {t:'Até R$ 1.500,00/mês',                 r:'Não! A faixa de isenção em 2024 é até R$ 2.824,00/mês.',proximo:null},
          {t:'Até R$ 3.500,00/mês',                 r:'Não chegamos lá ainda! A isenção é até R$ 2.824,00. Acima disso incide IR.',proximo:null},
          {t:'Não há faixa isenta',                  r:'Há sim! Rendimentos mensais até R$ 2.824,00 são isentos de IR.',proximo:null},
        ]},
      { pergunta: 'O que é Taxa Administrativa?',
        opcoes: [
          {t:'Custo pela gestão de um serviço ou fundo', r:'Correto! É o valor cobrado por administrar, operar ou gerenciar algo.',
            proximo:{pergunta:'E o Valor de Repasse é:',opcoes:[
              {t:'O valor transferido após as deduções', r:'Exato! Repasse = bruto − taxas e deduções. É o que chega ao destinatário final.', proximo:null},
              {t:'O total bruto da operação',            r:'Não! O bruto é antes. Repasse é o que sobra depois das deduções.', proximo:null},
              {t:'A multa contratual',                   r:'Diferente! Multa é penalidade por descumprimento. Repasse é o valor transferido após descontos.', proximo:null},
            ]}},
          {t:'Um imposto federal',                   r:'Não é imposto! Taxa administrativa é cobrada pelo prestador do serviço.',proximo:null},
          {t:'Multa por atraso',                     r:'São coisas diferentes! Multa é por descumprimento. Taxa administrativa é pelo serviço de gestão.',proximo:null},
          {t:'Não sei',                               r:'Taxa administrativa = valor cobrado pela gestão de um serviço ou contrato. Não é tributo!',proximo:null},
        ]},
      { pergunta: 'Qual a diferença entre Devolução e Ressarcimento?',
        opcoes: [
          {t:'Devolução: pagamento indevido. Ressarcimento: reembolso de terceiro', r:'Perfeito! Devolução retorna o que foi pago errado. Ressarcimento reembolsa quem pagou por você.',
            proximo:{pergunta:'Exemplo: você pagou uma conta da empresa do próprio bolso. A empresa te paga de volta. Isso é:',opcoes:[
              {t:'Ressarcimento',                    r:'Correto! Você pagou por terceiro (empresa) e foi reembolsado. Isso é ressarcimento!', proximo:null},
              {t:'Devolução',                        r:'Não! Devolução é retorno de pagamento indevido. Aqui você pagou algo da empresa e foi reembolsado — ressarcimento.', proximo:null},
              {t:'Desconto',                         r:'Não! Desconto é redução no preço. Você foi reembolsado por pagar algo da empresa — isso é ressarcimento.', proximo:null},
            ]}},
          {t:'São a mesma coisa',                    r:'Não são! Devolução = pagamento indevido devolvido. Ressarcimento = reembolso por despesa de terceiro.',proximo:null},
          {t:'Devolução é mais formal',              r:'Não é questão de formalidade! São situações distintas com tratamentos contábeis diferentes.',proximo:null},
          {t:'Não sei a diferença',                  r:'Devolução: pagou errado, devolvem. Ressarcimento: pagou por outra pessoa, te reembolsam. Anota!',proximo:null},
        ]},
      { pergunta: 'Cálculo rápido! Quanto é 15% de R$ 3.200,00?',
        opcoes: [
          {t:'R$ 480,00',                            r:'Correto! 3.200 × 0,15 = 480. Raciocínio financeiro afiado!',
            proximo:{pergunta:'Ótimo! Agora: quanto é 27,5% de R$ 5.000,00?',opcoes:[
              {t:'R$ 1.375,00',                      r:'Perfeito! 5.000 × 0,275 = 1.375. Você entende de alíquotas!', proximo:null},
              {t:'R$ 1.500,00',                      r:'Errou! 5.000 × 0,275 = 1.375. Atenção na vírgula da alíquota!', proximo:null},
              {t:'R$ 1.250,00',                      r:'Errou! Esse seria 25%. Para 27,5%: 5.000 × 0,275 = R$ 1.375,00.', proximo:null},
            ]}},
          {t:'R$ 320,00',                            r:'Errou! Isso seria 10%. Para 15%: 3.200 × 0,15 = R$ 480,00.',proximo:null},
          {t:'R$ 640,00',                            r:'Errou! Isso seria 20%. Para 15%: 3.200 × 0,15 = R$ 480,00.',proximo:null},
          {t:'R$ 560,00',                            r:'Errou! Para 15%: divida por 10 (= 320) e some a metade (+ 160) = R$ 480,00.',proximo:null},
        ]},
      /* ── Controle financeiro pessoal ── */
      { pergunta: 'Você tem uma reserva de emergência?',
        opcoes: [
          {t:'Sim, 3 a 6 meses de gastos!',   r:'Excelente! O padrão ideal. Agora foque em fazer o excedente trabalhar por você!',
            proximo:{pergunta:'Onde você guarda essa reserva?',opcoes:[
              {t:'CDB ou Tesouro Selic',        r:'Ótima escolha! Liquidez diária + rendimento acima da poupança. Perfeito!', proximo:null},
              {t:'Poupança',                    r:'Segura, mas rende abaixo da inflação. Considere migrar para Tesouro Selic.', proximo:null},
              {t:'Conta corrente',              r:'Risco! Dinheiro parado perde valor. Mova para investimento de liquidez diária!', proximo:null},
            ]}},
          {t:'Estou construindo ainda',         r:'Ótimo caminho! Meta: 3 meses de gastos primeiro. Automatize a transferência!',proximo:null},
          {t:'Não tenho reserva',               r:'Urgente! Sem reserva, qualquer imprevisto vira dívida. Comece com R$ 50/mês!',proximo:null},
          {t:'O que é reserva de emergência?',  r:'É 3 a 6 meses de gastos mensais guardados em investimento de liquidez imediata.',proximo:null},
        ]},
      { pergunta: 'Você conhece a regra 50-30-20?',
        opcoes: [
          {t:'Sim: 50% necessidades, 30% desejos, 20% investimentos',r:'Perfeito! Essa distribuição é o equilíbrio financeiro ideal.',
            proximo:{pergunta:'Você consegue aplicar essa regra?',opcoes:[
              {t:'Aplico e funciona bem!',      r:'Você está à frente da maioria! Agora pense em aumentar o % de investimento.', proximo:null},
              {t:'Tento mas é difícil',         r:'Registre todos os gastos por 30 dias primeiro. O diagnóstico vem sozinho.', proximo:null},
              {t:'Meus fixos passam de 50%',    r:'Revise contratos, planos e assinaturas. Sempre há espaço para cortar!', proximo:null},
            ]}},
          {t:'Nunca ouvi falar',                r:'Anota! 50% para necessidades, 30% para desejos, 20% para guardar e investir.',proximo:null},
          {t:'Conheço mas não pratico',         r:'O primeiro passo: registrar seus gastos atuais para ver onde está o desvio.',proximo:null},
          {t:'Uso uma regra diferente',         r:'Qualquer metodologia funciona se você seguir com consistência!',proximo:null},
        ]},
      { pergunta: 'Como você lida com cartão de crédito?',
        opcoes: [
          {t:'Pago a fatura total todo mês',   r:'Disciplina financeira exemplar! Cartão como aliado, não inimigo.',
            proximo:{pergunta:'Você aproveita cashback ou milhas?',opcoes:[
              {t:'Sim, de forma estratégica!',  r:'Inteligência financeira de alto nível! Benefícios sem juros = ganho puro.', proximo:null},
              {t:'Não uso esses benefícios',    r:'Vale pesquisar! Muitos cartões oferecem cashback sem anuidade.', proximo:null},
              {t:'Não sabia que existia',       r:'Pesquise cartões com cashback ou milhas. Pode render bons benefícios!', proximo:null},
            ]}},
          {t:'Às vezes pago só o mínimo',      r:'Cuidado! O rotativo do cartão pode chegar a 400% ao ano. Quite o quanto antes!',proximo:null},
          {t:'Estou com dívida no cartão',     r:'Prioridade máxima! Juros de cartão são os maiores do mercado. Negocie agora.',proximo:null},
          {t:'Prefiro não usar cartão',        r:'Postura conservadora válida! Com controle, o cartão pode trazer benefícios.',proximo:null},
        ]},
    ],
    conclusao:'Relatório financeiro do dia: aprovado! Você finalizou todas as perguntas. Até mais tarde!',

    alertaFome:    'Reserva de calorias abaixo do mínimo!',
    alertaEnergia: 'Déficit energético crítico detectado!',
    alertaSono:    'Horas de sono: abaixo do ideal. Requer correção!',
    alertaFome:    '...Recursos alimentares se esgotando.',
    alertaEnergia: 'Energia vital em declínio. Intervenção necessária.',
    alertaSono:    'O ciclo circadiano exige repouso agora.',
    dormindo: ['...O ciclo noturno começa. Silêncio.','Reintegração ao ritmo circadiano. Boa noite.','Conservando energia para amanhã.'],
    acordando: ['Novo ciclo iniciado. Bom dia.','O sol voltou. E eu também.','Renovado como a natureza pela manhã.'],  },
};

const COMIDAS = [
  /* Saudáveis */
  {id:'sushi',    nome:'Sushi',               cat:'proteina', saudavel:true,  fome:25, energia:12,
   r:'Sushi! Proteína nobre e leveza. Escolha de qualidade!'},
  {id:'acai',     nome:'Açaí Vitaminado',      cat:'fruta',    saudavel:true,  fome:20, energia:22,
   r:'Açaí com granola! Antioxidantes, energia e sabor. Perfeito!'},
  {id:'salada',   nome:'Salada de Frutas',     cat:'fruta',    saudavel:true,  fome:18, energia:16,
   r:'Vitaminas e cores! Cada fruta uma nutrição diferente. Amei!'},
  {id:'granola',  nome:'Granola com Iogurte',  cat:'cereal',   saudavel:true,  fome:22, energia:20,
   r:'Fibras, probióticos e proteínas! Isso é cuidar do corpo!'},
  {id:'frango',   nome:'Frango Grelhado',      cat:'proteina', saudavel:true,  fome:28, energia:18,
   r:'Proteína magra! Combustível real para o dia. Muito bom!'},
  {id:'vitamina', nome:'Vitamina Verde',       cat:'bebida',   saudavel:true,  fome:16, energia:28,
   r:'Verde de energia! Espinafre, banana e limão. Pura vitalidade!'},
  {id:'arroz',    nome:'Arroz, Feijão e Ovo',  cat:'refeicao', saudavel:true,  fome:32, energia:22,
   r:'O trio sagrado! Completo e nutritivo. Comida de verdade!'},
  {id:'abacate',  nome:'Torrada com Abacate',  cat:'cereal',   saudavel:true,  fome:18, energia:20,
   r:'Gordura boa e fibras! Escolha inteligente e gostosa!'},
  /* Especiais (não tão saudáveis) */
  {id:'carne',    nome:'Carne & Batata Frita', cat:'indulg',   saudavel:false, fome:36, energia:6,
   r:'Que festa! Aproveite, mas não todo dia, combinado?'},
  {id:'bolo',     nome:'Bolo de Chocolate',   cat:'indulg',   saudavel:false, fome:30, energia:-5,
   r:'CHOCOLATE! Que delícia! Fica entre nós, né?'},
  {id:'pizza',    nome:'Pizza',               cat:'indulg',   saudavel:false, fome:33, energia:8,
   r:'PIZZA! Hoje é dia de celebração! Que alegria!'},
  {id:'sorvete',  nome:'Sorvete',             cat:'indulg',   saudavel:false, fome:20, energia:-3,
   r:'Gelado e reconfortante! Às vezes a alma precisa disso!'},
];

const COMIDA_ICONS = {
  proteina: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
    <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/>
    <line x1="14" y1="1" x2="14" y2="4"/>
  </svg>,
  fruta: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>,
  cereal: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <path d="M3 11l19-9-9 19-2-8-8-2z"/>
  </svg>,
  bebida: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>,
  refeicao: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><line x1="7" y1="2" x2="7" y2="11"/>
    <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
  </svg>,
  indulg: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="1.7" strokeLinecap="round">
    <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>
  </svg>,
};

/* Cenários minimalistas — itens orgânicos e aleatórios ao redor do Doko */
const DOKO_SCENES = {
  tecnico: ({color,w=560,h=460}) => (
    <svg viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
      fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">

      {/* ── TOP-LEFT cluster ── */}
      <g transform="rotate(-18 55 55)" opacity="0.22">
        {/* monitor inclinado */}
        <rect x="18" y="32" width="62" height="42" rx="3" strokeWidth="1.4"/>
        <line x1="18" y1="52" x2="80" y2="52" strokeWidth="0.9"/>
        <line x1="42" y1="74" x2="42" y2="82" strokeWidth="1.4"/>
        <line x1="30" y1="82" x2="54" y2="82" strokeWidth="1.3"/>
      </g>

      {/* ── TOP-LEFT floating bits ── */}
      <circle cx="108" cy="28" r="2.5" fill={color} strokeWidth="0" opacity="0.2"/>
      <line x1="14" y1="100" x2="42" y2="100" strokeWidth="1.2" opacity="0.16"/>
      <line x1="14" y1="108" x2="34" y2="108" strokeWidth="1.2" opacity="0.13"/>
      <line x1="14" y1="116" x2="38" y2="116" strokeWidth="1.2" opacity="0.15"/>
      <rect x="10" y="98" width="3" height="22" rx="1" fill={color} strokeWidth="0" opacity="0.16"/>

      {/* ── TOP — wifi rotacionado ── */}
      <g transform="rotate(12 470 54)" opacity="0.26">
        <path d="M444 36 Q470 16 496 36" strokeWidth="1.8"/>
        <path d="M452 50 Q470 36 488 50" strokeWidth="1.8"/>
        <circle cx="470" cy="62" r="3.5" fill={color} strokeWidth="0"/>
      </g>

      {/* ── RIGHT EDGE — roteador tombado ── */}
      <g transform="rotate(8 518 195)" opacity="0.2">
        <rect x="494" y="172" width="58" height="28" rx="4" strokeWidth="1.4"/>
        <line x1="508" y1="164" x2="504" y2="172" strokeWidth="1.4"/>
        <line x1="523" y1="161" x2="523" y2="172" strokeWidth="1.5"/>
        <line x1="538" y1="164" x2="542" y2="172" strokeWidth="1.4"/>
        <circle cx="504" cy="188" r="2.2" fill={color} strokeWidth="0"/>
        <circle cx="515" cy="188" r="2.2" fill={color} strokeWidth="0"/>
        <circle cx="526" cy="188" r="2.2" fill={color} strokeWidth="0"/>
      </g>

      {/* ── RIGHT EDGE — bateria inclinada ── */}
      <g transform="rotate(-22 520 295)" opacity="0.18">
        <rect x="498" y="274" width="46" height="22" rx="3" strokeWidth="1.4"/>
        <rect x="544" y="280" width="6" height="10" rx="1" fill={color} strokeWidth="0" opacity="0.5"/>
        <rect x="502" y="278" width="18" height="14" rx="2" fill={color} strokeWidth="0" opacity="0.25"/>
      </g>

      {/* ── BOTTOM-LEFT — teclado rotacionado ── */}
      <g transform="rotate(15 52 375)" opacity="0.18">
        <rect x="14" y="355" width="78" height="42" rx="4" strokeWidth="1.4"/>
        {[0,1,2,3,4,5].map(i=>(
          <rect key={i} x={18+i*12} y={361} width="9" height="7" rx="1.5" strokeWidth="1" opacity="0.7"/>
        ))}
        {[0,1,2,3,4,5].map(i=>(
          <rect key={i} x={18+i*12} y={372} width="9" height="7" rx="1.5" strokeWidth="1" opacity="0.7"/>
        ))}
      </g>

      {/* ── BOTTOM-RIGHT — mouse torto ── */}
      <g transform="rotate(-14 508 368)" opacity="0.2">
        <rect x="490" y="348" width="36" height="50" rx="14" strokeWidth="1.5"/>
        <line x1="508" y1="348" x2="508" y2="374" strokeWidth="1.2"/>
        <line x1="490" y1="374" x2="526" y2="374" strokeWidth="1"/>
      </g>

      {/* ── BOTTOM-RIGHT — headphone tombado ── */}
      <g transform="rotate(20 520 424)" opacity="0.18">
        <path d="M494 418 Q508 400 528 400 Q548 400 556 418" strokeWidth="1.6"/>
        <rect x="488" y="416" width="12" height="20" rx="5" strokeWidth="1.4"/>
        <rect x="550" y="416" width="12" height="20" rx="5" strokeWidth="1.4"/>
      </g>

      {/* ── Pontos/pixels aleatórios ── */}
      <circle cx="76"  cy="142" r="1.8" fill={color} strokeWidth="0" opacity="0.15"/>
      <circle cx="488" cy="130" r="2"   fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="38"  cy="246" r="1.5" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="532" cy="252" r="1.8" fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="148" cy="434" r="2"   fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="412" cy="440" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="270" cy="14"  r="1.5" fill={color} strokeWidth="0" opacity="0.14"/>

      {/* Barras de sinal pequenas */}
      <g transform="translate(50,16)" opacity="0.18">
        <rect x="0"  y="14" width="6" height="8"  rx="1" fill={color} strokeWidth="0"/>
        <rect x="9"  y="10" width="6" height="12" rx="1" fill={color} strokeWidth="0"/>
        <rect x="18" y="6"  width="6" height="16" rx="1" fill={color} strokeWidth="0"/>
        <rect x="27" y="2"  width="6" height="20" rx="1" fill={color} strokeWidth="0"/>
      </g>
    </svg>
  ),

  cozinheiro: ({color,w=560,h=460}) => (
    <svg viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
      fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">

      {/* ── TOP-LEFT — chama dançante ── */}
      <g transform="rotate(-8 52 64)" opacity="0.26">
        <path d="M44 82 Q38 62 46 44 Q54 58 48 68 Q60 52 56 36 Q70 50 66 72 Q62 88 52 92 Q38 86 44 82Z"
          strokeWidth="1.5"/>
      </g>

      {/* ── TOP-LEFT — vaporzinhos caóticos ── */}
      <path d="M14 46 Q20 30 14 14"  strokeWidth="1.5" opacity="0.18" transform="rotate(12 14 30)"/>
      <path d="M28 52 Q36 32 28 12"  strokeWidth="1.5" opacity="0.2"  transform="rotate(-8 28 32)"/>
      <path d="M44 44 Q50 28 44 10"  strokeWidth="1.5" opacity="0.16" transform="rotate(5 44 27)"/>

      {/* ── TOP-RIGHT — espátula girada ── */}
      <g transform="rotate(-35 494 54)" opacity="0.22">
        <line x1="494" y1="18" x2="494" y2="78" strokeWidth="2"/>
        <rect x="488" y="14" width="12" height="22" rx="4" strokeWidth="1.5"/>
        <line x1="488" y1="44" x2="500" y2="44" strokeWidth="1" opacity="0.6"/>
      </g>

      {/* ── TOP-RIGHT — fouet ── */}
      <g transform="rotate(28 450 46)" opacity="0.19">
        <line x1="450" y1="14" x2="450" y2="72" strokeWidth="1.8"/>
        <path d="M446 16 Q454 26 448 38" strokeWidth="1.3"/>
        <path d="M454 14 Q462 24 456 36" strokeWidth="1.3"/>
      </g>

      {/* ── LEFT EDGE — colher tombada ── */}
      <g transform="rotate(80 32 185)" opacity="0.2">
        <path d="M32 155 Q32 135 46 130 Q60 130 60 145 Q60 162 46 168Z" strokeWidth="1.5"/>
        <line x1="46" y1="168" x2="46" y2="228" strokeWidth="1.5"/>
      </g>

      {/* ── LEFT EDGE — garfo caído ── */}
      <g transform="rotate(65 22 295)" opacity="0.19">
        <line x1="22" y1="258" x2="22" y2="330" strokeWidth="1.6"/>
        <line x1="16" y1="258" x2="16" y2="276" strokeWidth="1.2"/>
        <line x1="22" y1="258" x2="22" y2="276" strokeWidth="1.2"/>
        <line x1="28" y1="258" x2="28" y2="276" strokeWidth="1.2"/>
        <path d="M16 276 Q22 290 28 276" strokeWidth="1.2"/>
      </g>

      {/* ── RIGHT EDGE — panela torta ── */}
      <g transform="rotate(-12 522 178)" opacity="0.2">
        <ellipse cx="514" cy="178" rx="30" ry="11" strokeWidth="1.5"/>
        <rect x="484" y="148" width="60" height="30" rx="3" strokeWidth="1.5"/>
        <line x1="478" y1="178" x2="484" y2="178" strokeWidth="2.5"/>
        <line x1="544" y1="178" x2="548" y2="178" strokeWidth="2.5"/>
      </g>

      {/* ── RIGHT EDGE — temporizador inclinado ── */}
      <g transform="rotate(10 518 315)" opacity="0.19">
        <circle cx="518" cy="315" r="24" strokeWidth="1.5"/>
        <line x1="518" y1="291" x2="518" y2="315" strokeWidth="1.5"/>
        <line x1="518" y1="315" x2="534" y2="328" strokeWidth="1.3"/>
        <line x1="510" y1="289" x2="526" y2="289" strokeWidth="1.8"/>
      </g>

      {/* ── BOTTOM-LEFT — xícara tombada ── */}
      <g transform="rotate(-20 40 400)" opacity="0.2">
        <rect x="10" y="384" width="42" height="30" rx="4" strokeWidth="1.5"/>
        <path d="M52 390 Q64 390 64 402 Q64 414 52 414" strokeWidth="1.4"/>
        <ellipse cx="31" cy="384" rx="21" ry="6" strokeWidth="1.2"/>
      </g>

      {/* ── BOTTOM-LEFT — vapores ── */}
      <path d="M96 428 Q100 412 96 396"  strokeWidth="1.5" opacity="0.2" transform="rotate(-6 96 412)"/>
      <path d="M110 432 Q115 414 110 396" strokeWidth="1.5" opacity="0.22" transform="rotate(8 110 414)"/>
      <path d="M124 428 Q128 412 124 398" strokeWidth="1.5" opacity="0.18" transform="rotate(-4 124 413)"/>

      {/* ── BOTTOM-RIGHT — tomate girado ── */}
      <g transform="rotate(22 502 398)" opacity="0.2">
        <circle cx="502" cy="398" r="24" strokeWidth="1.5"/>
        <path d="M494 374 Q502 362 510 374" strokeWidth="1.3"/>
      </g>

      {/* ── BOTTOM-RIGHT — cenoura tombada ── */}
      <g transform="rotate(-42 528 432)" opacity="0.18">
        <path d="M510 420 L538 448 L526 432 L542 420 L528 408 Z" strokeWidth="1.4"/>
        <path d="M524 406 Q530 394 526 408" strokeWidth="1.2"/>
      </g>

      {/* Pontos espalhados */}
      <circle cx="130" cy="22" r="2"   fill={color} strokeWidth="0" opacity="0.15"/>
      <circle cx="290" cy="16" r="1.8" fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="400" cy="30" r="2"   fill={color} strokeWidth="0" opacity="0.15"/>
      <circle cx="60"  cy="200" r="1.6" fill={color} strokeWidth="0" opacity="0.12"/>
      <circle cx="50"  cy="316" r="1.5" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="496" cy="252" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="200" cy="442" r="2"   fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="358" cy="438" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
    </svg>
  ),

  medico: ({color,w=560,h=460}) => (
    <svg viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
      fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">

      {/* ── TOP — batimentos quebrados nos lados ── */}
      <polyline points="14,62 40,62 52,36 64,88 76,48 90,64 116,64"
        strokeWidth="1.8" opacity="0.26"/>
      <polyline points="440,58 460,58 468,38 476,74 484,52 494,62 520,62"
        strokeWidth="1.6" opacity="0.2"/>

      {/* ── TOP-LEFT — cruz girada ── */}
      <g transform="rotate(12 40 40)" opacity="0.24">
        <line x1="40" y1="22" x2="40" y2="58" strokeWidth="2.2"/>
        <line x1="22" y1="40" x2="58" y2="40" strokeWidth="2.2"/>
      </g>

      {/* ── TOP-RIGHT — cápsula inclinada ── */}
      <g transform="rotate(-38 502 52)" opacity="0.2">
        <rect x="488" y="26" width="28" height="52" rx="14" strokeWidth="1.5"/>
        <line x1="488" y1="52" x2="516" y2="52" strokeWidth="1" opacity="0.6"/>
      </g>

      {/* ── LEFT EDGE — estetoscópio ── */}
      <g transform="rotate(5 48 160)" opacity="0.21">
        <path d="M28 140 Q28 106 52 94 Q76 84 80 108" strokeWidth="1.8"/>
        <circle cx="80" cy="115" r="12" strokeWidth="1.8"/>
        <line x1="22" y1="140" x2="34" y2="140" strokeWidth="2.2"/>
      </g>

      {/* ── LEFT EDGE — seringa tombada ── */}
      <g transform="rotate(70 26 278)" opacity="0.19">
        <rect x="16" y="248" width="14" height="56" rx="2" strokeWidth="1.4"/>
        <rect x="12" y="244" width="22" height="10" rx="2" strokeWidth="1.3"/>
        <line x1="23" y1="304" x2="23" y2="318" strokeWidth="2.2"/>
        <line x1="12" y1="264" x2="30" y2="264" strokeWidth="1"/>
        <line x1="12" y1="278" x2="30" y2="278" strokeWidth="1"/>
      </g>

      {/* ── LEFT EDGE — termômetro inclinado ── */}
      <g transform="rotate(-22 28 362)" opacity="0.2">
        <rect x="20" y="332" width="12" height="46" rx="6" strokeWidth="1.4"/>
        <circle cx="26" cy="380" r="9" strokeWidth="1.4"/>
        <line x1="24" y1="342" x2="30" y2="342" strokeWidth="1"/>
        <line x1="24" y1="354" x2="30" y2="354" strokeWidth="1"/>
        <line x1="24" y1="366" x2="30" y2="366" strokeWidth="1"/>
      </g>

      {/* ── RIGHT EDGE — prancheta girada ── */}
      <g transform="rotate(-8 518 185)" opacity="0.19">
        <rect x="490" y="152" width="56" height="66" rx="3" strokeWidth="1.4"/>
        <rect x="506" y="144" width="24" height="14" rx="3" strokeWidth="1.3"/>
        <line x1="498" y1="176" x2="538" y2="176" strokeWidth="1"/>
        <line x1="498" y1="188" x2="530" y2="188" strokeWidth="1"/>
        <line x1="498" y1="200" x2="534" y2="200" strokeWidth="1"/>
      </g>

      {/* ── RIGHT EDGE — comprimido ── */}
      <g transform="rotate(32 510 298)" opacity="0.19">
        <ellipse cx="510" cy="298" rx="26" ry="12" strokeWidth="1.5"/>
        <line x1="484" y1="298" x2="536" y2="298" strokeWidth="1"/>
      </g>

      {/* ── BOTTOM-LEFT — kit médico ── */}
      <g transform="rotate(-10 48 406)" opacity="0.2">
        <rect x="14" y="386" width="68" height="44" rx="5" strokeWidth="1.5"/>
        <line x1="46" y1="395" x2="54" y2="395" strokeWidth="2"/>
        <line x1="50" y1="391" x2="50" y2="405" strokeWidth="2"/>
        <line x1="14" y1="408" x2="82" y2="408" strokeWidth="0.9"/>
        <line x1="48" y1="386" x2="48" y2="430" strokeWidth="0.9"/>
      </g>

      {/* ── BOTTOM — gráfico de saúde espalhado ── */}
      <polyline points="110,434 148,414 190,424 230,402 270,414 310,396 350,408 390,386 430,400"
        strokeWidth="1.4" opacity="0.18"/>

      {/* ── BOTTOM-RIGHT — microscópio ── */}
      <g transform="rotate(6 512 394)" opacity="0.19">
        <line x1="512" y1="362" x2="512" y2="420" strokeWidth="2"/>
        <ellipse cx="512" cy="360" rx="16" ry="9" strokeWidth="1.5"/>
        <line x1="512" y1="420" x2="490" y2="436" strokeWidth="1.8"/>
        <line x1="512" y1="420" x2="534" y2="436" strokeWidth="1.8"/>
        <line x1="490" y1="436" x2="534" y2="436" strokeWidth="1.5"/>
      </g>

      {/* Pontos */}
      <circle cx="165" cy="26" r="2"   fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="310" cy="18" r="1.8" fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="418" cy="30" r="2"   fill={color} strokeWidth="0" opacity="0.15"/>
      <circle cx="66"  cy="244" r="1.6" fill={color} strokeWidth="0" opacity="0.12"/>
      <circle cx="496" cy="118" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="268" cy="446" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
    </svg>
  ),

  ambiental: ({color,w=560,h=460}) => (
    <svg viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
      fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">

      {/* ── Estrelas espalhadas (topo e cantos) ── */}
      <circle cx="52"  cy="24" r="2.5" fill={color} strokeWidth="0" opacity="0.3"/>
      <circle cx="108" cy="12" r="1.8" fill={color} strokeWidth="0" opacity="0.24"/>
      <circle cx="174" cy="32" r="1.4" fill={color} strokeWidth="0" opacity="0.2"/>
      <circle cx="240" cy="16" r="2.2" fill={color} strokeWidth="0" opacity="0.22"/>
      <circle cx="318" cy="22" r="1.5" fill={color} strokeWidth="0" opacity="0.2"/>
      <circle cx="388" cy="12" r="2"   fill={color} strokeWidth="0" opacity="0.26"/>
      <circle cx="444" cy="28" r="1.6" fill={color} strokeWidth="0" opacity="0.2"/>
      <circle cx="502" cy="16" r="2.2" fill={color} strokeWidth="0" opacity="0.28"/>
      <circle cx="536" cy="44" r="1.4" fill={color} strokeWidth="0" opacity="0.2"/>

      {/* ── TOP-LEFT — lua crescente inclinada ── */}
      <g transform="rotate(-18 46 66)" opacity="0.26">
        <path d="M30 46 A24 24 0 1 1 30 90 A17 17 0 1 0 30 46 Z" strokeWidth="1.5"/>
      </g>

      {/* ── TOP-RIGHT — sol irradiante ── */}
      <g transform="rotate(15 492 58)" opacity="0.2">
        <circle cx="492" cy="58" r="18" strokeWidth="1.5"/>
        <line x1="492" y1="30" x2="492" y2="22" strokeWidth="1.5"/>
        <line x1="492" y1="86" x2="492" y2="94" strokeWidth="1.5"/>
        <line x1="464" y1="58" x2="456" y2="58" strokeWidth="1.5"/>
        <line x1="520" y1="58" x2="528" y2="58" strokeWidth="1.5"/>
        <line x1="472" y1="38" x2="466" y2="32" strokeWidth="1.3"/>
        <line x1="512" y1="78" x2="518" y2="84" strokeWidth="1.3"/>
        <line x1="512" y1="38" x2="518" y2="32" strokeWidth="1.3"/>
        <line x1="472" y1="78" x2="466" y2="84" strokeWidth="1.3"/>
      </g>

      {/* ── TOP — 2 nuvens espalhadas ── */}
      <g transform="rotate(-5 184 52)" opacity="0.18">
        <path d="M154 56 Q160 42 172 44 Q175 36 188 38 Q202 36 204 48 Q214 48 214 58 Z" strokeWidth="1.4"/>
      </g>
      <g transform="rotate(8 358 38)" opacity="0.15">
        <path d="M332 42 Q338 30 348 32 Q350 24 362 26 Q372 24 374 34 Q380 34 380 42 Z" strokeWidth="1.3"/>
      </g>

      {/* ── LEFT — folha girada ── */}
      <g transform="rotate(38 36 158)" opacity="0.22">
        <path d="M14 156 Q38 126 60 156 Q38 172 14 156 Z" strokeWidth="1.4"/>
        <line x1="14" y1="156" x2="60" y2="156" strokeWidth="1"/>
        <line x1="26" y1="150" x2="30" y2="162" strokeWidth="0.9"/>
        <line x1="38" y1="144" x2="40" y2="156" strokeWidth="0.9"/>
      </g>

      {/* ── LEFT — árvore maior orgânica ── */}
      <g transform="rotate(4 38 272)" opacity="0.2">
        <line x1="38" y1="290" x2="38" y2="390" strokeWidth="2.8"/>
        <ellipse cx="38" cy="262" rx="28" ry="36" strokeWidth="1.5"/>
        <ellipse cx="20" cy="278" rx="18" ry="24" strokeWidth="1.2"/>
        <ellipse cx="56" cy="274" rx="18" ry="24" strokeWidth="1.2"/>
      </g>

      {/* ── RIGHT — árvore menor inclinada ── */}
      <g transform="rotate(-7 524 296)" opacity="0.18">
        <line x1="524" y1="316" x2="524" y2="400" strokeWidth="2.2"/>
        <ellipse cx="524" cy="292" rx="22" ry="28" strokeWidth="1.4"/>
        <ellipse cx="508" cy="304" rx="14" ry="20" strokeWidth="1.2"/>
      </g>

      {/* ── RIGHT — painel solar torto ── */}
      <g transform="rotate(12 516 164)" opacity="0.18">
        <rect x="488" y="148" width="56" height="38" rx="3" strokeWidth="1.4"/>
        <line x1="488" y1="167" x2="544" y2="167" strokeWidth="1"/>
        <line x1="507" y1="148" x2="507" y2="186" strokeWidth="1"/>
        <line x1="526" y1="148" x2="526" y2="186" strokeWidth="1"/>
      </g>

      {/* ── RIGHT — borboleta ── */}
      <g transform="rotate(-25 498 268)" opacity="0.19">
        <path d="M498 268 Q484 252 484 268 Q484 282 498 276" strokeWidth="1.3"/>
        <path d="M498 268 Q512 252 512 268 Q512 282 498 276" strokeWidth="1.3"/>
        <line x1="498" y1="266" x2="498" y2="284" strokeWidth="1.2"/>
      </g>

      {/* ── BOTTOM — grama orgânica ── */}
      <g opacity="0.2">
        <path d="M68 438  Q74 416 80 438"  strokeWidth="1.5" transform="rotate(-4 74 427)"/>
        <path d="M88 442  Q95 418 102 442" strokeWidth="1.5" transform="rotate(6 95 430)"/>
        <path d="M108 436 Q114 416 120 436" strokeWidth="1.5" transform="rotate(-8 114 426)"/>
        <path d="M370 440 Q376 418 382 440" strokeWidth="1.5" transform="rotate(5 376 429)"/>
        <path d="M392 436 Q399 416 406 436" strokeWidth="1.5" transform="rotate(-6 399 426)"/>
        <path d="M416 442 Q422 420 428 442" strokeWidth="1.5" transform="rotate(9 422 431)"/>
      </g>

      {/* ── BOTTOM — flor espalhada ── */}
      <g transform="rotate(18 208 428)" opacity="0.2">
        <circle cx="208" cy="428" r="7" strokeWidth="1.4"/>
        <path d="M208 421 Q213 412 208 405 Q203 412 208 421Z" strokeWidth="1.2"/>
        <path d="M215 424 Q224 420 227 424 Q224 430 215 427Z" strokeWidth="1.2"/>
        <path d="M201 424 Q192 420 189 424 Q192 430 201 427Z" strokeWidth="1.2"/>
        <path d="M208 435 Q213 444 208 451 Q203 444 208 435Z" strokeWidth="1.2"/>
      </g>

      {/* ── BOTTOM-RIGHT — reciclagem tombada ── */}
      <g transform="rotate(30 480 428)" opacity="0.2">
        <path d="M466 416 L478 396 L490 416 Z" strokeWidth="1.4"/>
        <path d="M458 430 L500 430" strokeWidth="1.2"/>
        <path d="M454 422 Q456 408 466 416" strokeWidth="1.2"/>
        <path d="M502 422 Q500 408 490 416" strokeWidth="1.2"/>
      </g>
    </svg>
  ),

  contador: ({color,w=560,h=460}) => (
    <svg viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
      fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">

      {/* ── TOP-LEFT — gráfico de barras inclinado ── */}
      <g transform="rotate(-12 56 70)" opacity="0.22">
        <rect x="18" y="58" width="16" height="40" rx="2" strokeWidth="1.4"/>
        <rect x="40" y="44" width="16" height="54" rx="2" strokeWidth="1.4"/>
        <rect x="62" y="30" width="16" height="68" rx="2" strokeWidth="1.4"/>
        <rect x="84" y="46" width="16" height="52" rx="2" strokeWidth="1.4"/>
        <line x1="14" y1="98" x2="106" y2="98" strokeWidth="1.2"/>
      </g>

      {/* ── TOP-LEFT — números flutuando ── */}
      <text x="14"  y="28" fontSize="11" fill={color} opacity="0.14" stroke="none" fontFamily="monospace"
        transform="rotate(-6 14 28)">R$4.800</text>
      <text x="110" y="18" fontSize="10" fill={color} opacity="0.12" stroke="none" fontFamily="monospace"
        transform="rotate(4 110 18)">+8,5%</text>

      {/* ── TOP-RIGHT — símbolo % inclinado ── */}
      <text x="472" y="72" fontSize="48" fill={color} opacity="0.13" stroke="none"
        fontFamily="monospace" transform="rotate(10 480 55)">%</text>

      {/* ── TOP-RIGHT — nota flutuante ── */}
      <text x="444" y="28" fontSize="10" fill={color} opacity="0.12" stroke="none" fontFamily="monospace"
        transform="rotate(-8 444 28)">27,5%</text>

      {/* ── LEFT — ábaco torto ── */}
      <g transform="rotate(8 32 215)" opacity="0.18">
        <line x1="16" y1="155" x2="16" y2="290" strokeWidth="1.5"/>
        <line x1="50" y1="155" x2="50" y2="290" strokeWidth="1.5"/>
        <line x1="12" y1="153" x2="54" y2="153" strokeWidth="1.5"/>
        <line x1="12" y1="292" x2="54" y2="292" strokeWidth="1.5"/>
        {[172,196,220,244,268].map((y,i)=>(
          <circle key={i} cx={i<3?20:10} cy={y} r="7" strokeWidth="1.4"/>
        ))}
        {[172,196,220,244].map((y,i)=>(
          <circle key={i} cx={i<2?44:54} cy={y} r="7" strokeWidth="1.4"/>
        ))}
      </g>

      {/* ── RIGHT — moedas empilhadas giradas ── */}
      <g transform="rotate(-14 518 168)" opacity="0.2">
        <ellipse cx="518" cy="168" rx="24" ry="8" strokeWidth="1.5"/>
        <ellipse cx="518" cy="154" rx="24" ry="8" strokeWidth="1.5"/>
        <ellipse cx="518" cy="140" rx="24" ry="8" strokeWidth="1.5"/>
        <line x1="494" y1="140" x2="494" y2="168" strokeWidth="1.2"/>
        <line x1="542" y1="140" x2="542" y2="168" strokeWidth="1.2"/>
      </g>

      {/* ── RIGHT — caneta tinteiro ── */}
      <g transform="rotate(-34 514 288)" opacity="0.18">
        <rect x="508" y="252" width="12" height="62" rx="5" strokeWidth="1.4"/>
        <path d="M514" y1="314 L508 332 L520 332 Z" strokeWidth="1.3"/>
        <line x1="508" y1="266" x2="520" y2="266" strokeWidth="1"/>
        <path d="M514 314 L508 332 L520 332 Z" strokeWidth="1.3"/>
      </g>

      {/* ── BOTTOM-LEFT — tendência ascendente ── */}
      <g transform="rotate(-6 110 376)" opacity="0.22">
        <polyline points="16,392 58,372 100,356 142,338 184,318"
          strokeWidth="1.5" strokeDasharray="5 3"/>
        <polygon points="184,308 196,328 172,328" strokeWidth="1.2"/>
      </g>

      {/* ── BOTTOM-LEFT — nota fiscal tombada ── */}
      <g transform="rotate(16 56 428)" opacity="0.18">
        <rect x="14" y="408" width="56" height="48" rx="3" strokeWidth="1.3"/>
        <line x1="20" y1="420" x2="64" y2="420" strokeWidth="1"/>
        <line x1="20" y1="430" x2="56" y2="430" strokeWidth="1"/>
        <line x1="20" y1="440" x2="60" y2="440" strokeWidth="1"/>
        <line x1="20" y1="450" x2="44" y2="450" strokeWidth="1"/>
      </g>

      {/* ── BOTTOM-RIGHT — calculadora ── */}
      <g transform="rotate(-10 510 390)" opacity="0.19">
        <rect x="480" y="354" width="62" height="76" rx="5" strokeWidth="1.5"/>
        <line x1="480" y1="376" x2="542" y2="376" strokeWidth="1"/>
        <rect x="488" y="358" width="44" height="14" rx="2" strokeWidth="1.2"/>
        {[0,1,2].map(i=>[0,1,2].map(j=>(
          <circle key={`${i}${j}`} cx={492+i*17} cy={388+j*16} r="4.5" strokeWidth="1.2"/>
        )))}
      </g>

      {/* ── BOTTOM CENTER — linha de tendência suave ── */}
      <polyline points="170,440 220,424 270,432 320,416 370,428 420,412"
        strokeWidth="1.2" strokeDasharray="3 4" opacity="0.15"/>

      {/* Pontos aleatórios */}
      <circle cx="186" cy="22"  r="1.8" fill={color} strokeWidth="0" opacity="0.15"/>
      <circle cx="346" cy="16"  r="1.5" fill={color} strokeWidth="0" opacity="0.14"/>
      <circle cx="444" cy="112" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="56"  cy="316" r="1.6" fill={color} strokeWidth="0" opacity="0.12"/>
      <circle cx="496" cy="336" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
      <circle cx="268" cy="446" r="1.8" fill={color} strokeWidth="0" opacity="0.13"/>
    </svg>
  ),
};

/* Chave de localStorage individualizada por usuário (CPF do JWT) — exportada
   para que outros módulos (TabInicio) usem exatamente a mesma chave */
export const DOKO_KEY = (() => {
  try {
    const auth = getAuthUser();
    return auth?.cpf ? `uniko_doko_${auth.cpf}` : 'uniko_doko';
  } catch { return 'uniko_doko'; }
})();

/* Taxas por tick de 8s — calibradas para ~7h de jornada */
const TICK_MS       = 8000;
const RATE_FOME_ON  = 0.025;  /* fome acordado:  100→~21 em 7h */
const RATE_ENER_ON  = 0.025;  /* energia acordado */
const RATE_SONO_ON  = 0.016;  /* sono acordado:   70→~20 em 7h */
const RATE_FOME_OFF = 0.008;  /* fome dormindo: cai devagar overnight */
const RATE_SONO_OFF = 2.5;    /* sono dormindo: recupera rápido */

const _dokoLoad = () => {
  try {
    const data = JSON.parse(localStorage.getItem(DOKO_KEY) || '{}');
    if (!data.lastUpdated) return data;

    const elapsed = Math.max(0, Date.now() - data.lastUpdated);
    if (elapsed < 10000) return data;

    const ticks   = elapsed / TICK_MS;
    let { fome = 75, energia = 70, sono = 70, dormindo = false, xp = 0 } = data;

    if (dormindo) {
      fome = Math.max(0,   fome - ticks * RATE_FOME_OFF);
      sono = Math.min(100, sono + ticks * RATE_SONO_OFF);
    } else {
      fome    = Math.max(0, fome    - ticks * RATE_FOME_ON);
      energia = Math.max(0, energia - ticks * RATE_ENER_ON);
      sono    = Math.max(0, sono    - ticks * RATE_SONO_ON);
    }

    return { ...data, fome, energia, sono, xp };
  } catch { return {}; }
};

const TabMyDoko = () => {
  const [fome,       setFome]       = useState(() => _dokoLoad().fome    ?? 75);
  const [energia,    setEnergia]    = useState(() => _dokoLoad().energia ?? 70);
  const [fala,       setFala]       = useState('Olá! Que bom te ver por aqui!');
  const [skin,       setSkin]       = useState(() => _dokoLoad().skin    || 'tecnico');
  const [showColecao,setShowColecao]= useState(false);
  const [showComidas,setShowComidas]= useState(false);
  const [dormindo,   setDormindo]   = useState(() => _dokoLoad().dormindo ?? false);
  const [sono,       setSono]       = useState(() => _dokoLoad().sono    ?? 70);
  const [xp,         setXp]         = useState(() => _dokoLoad().xp ?? 0);
  const [levelUpMsg, setLevelUpMsg] = useState(null);
  const [notif,      setNotif]      = useState(null); /* alerta de stat baixo */
  const alertasRef   = {fome:false, energia:false, sono:false}; /* controle de duplicata */
  const [bounce,     setBounce]     = useState(false);
  const [bounceDur,  setBounceDur]  = useState(3);
  const [conversa,   setConversa]   = useState(null);
  const [respondeu,  setRespondeu]  = useState(false);
  const [typing,     setTyping]     = useState(false);
  const [fila,       setFila]       = useState([]);
  const [filaTotal,  setFilaTotal]  = useState(0);
  const [sessaoAtiva,setSessaoAtiva]= useState(false);
  const [sessaoFim,  setSessaoFim]  = useState(false);
  const [pergAtual,  setPergAtual]  = useState('');    /* pergunta fixa visível */

  useEffect(()=>{
    localStorage.setItem(DOKO_KEY, JSON.stringify({ skin, fome, energia, sono, dormindo, xp, lastUpdated: Date.now() }));
  }, [skin, fome, energia, sono, dormindo, xp]);

  /* Sync Doko state to Supabase so colegas can see it */
  const _dokoSyncRef = useRef(null);
  useEffect(() => {
    if (!USER.name || USER.name === 'Colaborador') return;
    clearTimeout(_dokoSyncRef.current);
    _dokoSyncRef.current = setTimeout(() => {
      const nivel = xpToLevel(xp);
      _supabase.from('doko_states').upsert(
        { employee_name: USER.name, skin, fome, energia, sono, dormindo, xp, nivel, updated_at: new Date().toISOString() },
        { onConflict: 'employee_name' }
      );
    }, 4000);
  }, [skin, fome, energia, sono, dormindo, xp]);

  useEffect(()=>{
    const id=setInterval(()=>{
      if(dormindo){
        setFome(f=>Math.max(0,   f - RATE_FOME_OFF));
        setSono(s=>Math.min(100, s + RATE_SONO_OFF));
      } else {
        setFome(f=>Math.max(0,   f - RATE_FOME_ON));
        setEnergia(e=>Math.max(0,e - RATE_ENER_ON));
        setSono(s=>Math.max(0,   s - RATE_SONO_ON));
      }
    }, TICK_MS);
    return ()=>clearInterval(id);
  },[dormindo]);

  /* Alertas de threshold 49% */
  useEffect(()=>{
    if(dormindo) return;
    if(fome <= 49 && fome > 35){
      setNotif({msg: pers.alertaFome   || 'Estou ficando com fome!',      tipo:'fome'});
      setTimeout(()=>setNotif(null), 5000);
    }
  },[Math.floor(fome/10)]); // dispara quando cruza dezena

  useEffect(()=>{
    if(dormindo) return;
    if(energia <= 49 && energia > 25){
      setNotif({msg: pers.alertaEnergia || 'Estou ficando sem energia...', tipo:'energia'});
      setTimeout(()=>setNotif(null), 5000);
    }
  },[Math.floor(energia/10)]);

  useEffect(()=>{
    if(dormindo) return;
    if(sono <= 49 && sono > 15){
      setNotif({msg: pers.alertaSono   || 'Estou com sono! Hora de descansar...', tipo:'sono'});
      setTimeout(()=>setNotif(null), 5000);
    }
  },[Math.floor(sono/10)]);

  const nivel = xpToLevel(xp);

  const ganharXP = (amount) => {
    setXp(prev => {
      const oldLv = xpToLevel(prev);
      const newXp = prev + amount;
      const newLv = xpToLevel(newXp);
      if (newLv > oldLv) {
        const unlocked = UNIKO_COMMON.find(u => u.level === newLv);
        setLevelUpMsg({ nivel: newLv, uniko: unlocked || null });
        setTimeout(() => setLevelUpMsg(null), 7000);
      }
      return newXp;
    });
  };

  const pers       = DOKO_PERSONALIDADES[skin] || DOKO_PERSONALIDADES['tecnico'];
  const activeSkin = DOKO_SKINS.find(s=>s.id===skin) || (() => {
    const u = UNIKO_COMMON.find(u=>u.key===skin);
    return u ? { id:u.key, label:u.name, img:u.img, imgCansado:null, color:'#C9A000' } : DOKO_SKINS[0];
  })();
  const mood       = (fome+energia)/2>=70?'feliz':(fome+energia)/2>=35?'neutro':'triste';
  /* Estado cansado: fome E energia ambos críticos (abaixo de 25) */
  const isCansado  = fome < 25 && energia < 25;
  const dokoImg    = isCansado && activeSkin.imgCansado
                     ? activeSkin.imgCansado
                     : activeSkin.img;
  const barColor   = v=>v>=60?T.green:v>=30?T.gold:T.danger;
  const moodLabel  = {feliz:'Feliz',neutro:'Bem',triste:'Triste'};
  const rnd        = arr=>arr[Math.floor(Math.random()*arr.length)];

  const FALA_DUR = 8000;
  /* Resposta: mostra no balão e some após 8s */
  const dizer = txt => {
    setFala(txt);
    setBounce(true); setBounceDur(8);
    setTimeout(()=>setBounce(false), FALA_DUR);
    setTimeout(()=>setFala(''), FALA_DUR+400);
  };
  /* Pergunta: fica no balão até ser respondida + state fixo acima das opções */
  const dizerPergunta = (txt) => {
    setFala(txt);
    setPergAtual(txt);
    setBounce(true); setBounceDur(6);
    setTimeout(()=>setBounce(false), 6000);
    /* NÃO auto-limpa */
  };

  const alimentar = () => setShowComidas(s=>!s);
  const escolherComida = (comida) => {
    setFome(f=>Math.min(100, f+comida.fome));
    setEnergia(e=>Math.min(100, e+comida.energia));
    if (fome < 98) ganharXP(Math.round(comida.fome / 2)); /* XP só se a fome não estava cheia */
    setShowComidas(false);
    setConversa(null); setRespondeu(false); setTyping(false);
    setSessaoAtiva(false); setSessaoFim(false); setFila([]); setFilaTotal(0); setPergAtual('');
    dizer(comida.r);
  };
  const carinho = () => {
    setEnergia(e=>Math.min(100,e+22));
    setFome(f=>Math.min(100,f+3));
    if (energia < 98) ganharXP(15); /* XP só se a energia não estava cheia */
    setConversa(null); setRespondeu(false); setTyping(false); setSessaoAtiva(false); setSessaoFim(false); setFila([]); setFilaTotal(0); setPergAtual('');
    dizer(rnd(pers.pet));
  };
  const iniciarConversa = () => {
    const perguntas = [...pers.conversa];
    setSessaoAtiva(true); setSessaoFim(false);
    setFila(perguntas.slice(1));
    setFilaTotal(perguntas.length);
    setTyping(false);
    setConversa(perguntas[0]); setRespondeu(false);
    dizerPergunta(perguntas[0].pergunta);
  };
  const avancarFila = () => {
    if(fila.length > 0){
      const prox = fila[0];
      setFila(f=>f.slice(1));
      setConversa(prox); setRespondeu(false);
      dizerPergunta(prox.pergunta);
    } else {
      /* Sessão completa */
      setConversa(null);
      setRespondeu(false);
      setSessaoAtiva(false);
      setSessaoFim(true);
      setEnergia(e=>Math.min(100,e+35));
      ganharXP(20); /* +20 XP bônus por completar a sessão */
      dizer(pers.conclusao||'Você finalizou todas as perguntas por hoje! Até mais tarde!');
      setTimeout(()=>setSessaoFim(false),10000);
    }
  };
  const PROX_DELAY = 1200;  /* mostra typing após 1.2s de resposta */
  const PROX_SHOW  = 2800;  /* próxima pergunta após 2.8s total     */
  const responderOpcao = (opcao) => {
    setEnergia(e=>Math.min(100,e+(opcao.d||5)));
    setFome(f=>Math.min(100,f+3));
    ganharXP(10); /* +10 XP por resposta */
    setRespondeu(true);
    setPergAtual(''); /* limpa pergunta fixa ao responder */
    dizer(opcao.r);
    if(opcao.proximo){
      setTimeout(()=>setTyping(true), PROX_DELAY);
      setTimeout(()=>{
        setTyping(false);
        setConversa(opcao.proximo); setRespondeu(false);
        dizerPergunta(opcao.proximo.pergunta);
      }, PROX_SHOW);
    } else if(sessaoAtiva){
      setTimeout(()=>setTyping(true), PROX_DELAY);
      setTimeout(()=>{ setTyping(false); avancarFila(); }, PROX_SHOW);
    } else {
      setTimeout(()=>{setConversa(null); setRespondeu(false); setPergAtual('');}, PROX_SHOW);
    }
  };
  const toggleDormir = () => {
    setDormindo(d=>{
      const next = !d;
      if(next){
        /* Adormecendo */
        setShowComidas(false);
        setConversa(null); setRespondeu(false); setTyping(false);
        setSessaoAtiva(false); setSessaoFim(false);
        setFila([]); setFilaTotal(0); setPergAtual('');
        dizer(rnd(pers.dormindo||['Boa noite... zzz...','Hora de descansar...','Dormindo... não me acorde!']));
      } else {
        /* Acordando */
        dizer(rnd(pers.acordando||['Bom dia! Que sono gostoso!','Zzz... Hã? Já? Bom dia!','Descansado e pronto!']));
      }
      return next;
    });
  };

  const FRASES_CANSADO = {
    tecnico:    ['Bateria em 2%... socooorro...','Sistema em falha crítica... preciso de comida e descanso...','Modo emergência ativado. Recargue agora...'],
    cozinheiro: ['A frigideira caiu de mão... sem força...','Preciso de comida... que ironia...','Sem energia pra nem cozinhar um ovo...'],
    medico:     ['Diagnóstico: exaustão total. Prescrição: comida e carinho urgente!','Paciente em estado crítico... sou eu...','Sinais vitais baixíssimos! Emergência!'],
    ambiental:  ['...Recurso esgotado. Preciso de reabastecimento.','Desequilíbrio total. Sem energia para continuar.','...Seco como deserto. Ajuda.'],
    contador:   ['Saldo zerado... déficit total...','Balanço extremamente negativo. Requer intervenção!','Reserva de emergência esgotada. Situação crítica.'],
  };
  const clicarDoko = () => {
    if(conversa) return;
    if(isCansado){
      const list = FRASES_CANSADO[skin] || FRASES_CANSADO.tecnico;
      dizer(rnd(list));
    } else {
      dizer(rnd(pers[mood]));
    }
  };

  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      {/* Toast de level-up */}
      {levelUpMsg && (
        <div style={{position:'fixed',top:24,left:'50%',transform:'translateX(-50%)',
          zIndex:9999,background:T.surface,border:`2px solid ${T.gold}`,
          borderRadius:18,padding:'16px 28px',boxShadow:`0 8px 32px ${T.gold}44`,
          display:'flex',alignItems:'center',gap:14,maxWidth:420,minWidth:280,
          animation:'bubblePop .35s ease'}}>
          {levelUpMsg.uniko && (
            <img src={levelUpMsg.uniko.img} alt={levelUpMsg.uniko.name}
              style={{width:56,height:56,borderRadius:12,objectFit:'cover',flexShrink:0,
                border:`2px solid ${T.gold}55`}}/>
          )}
          <div>
            <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.gold,marginBottom:2}}>
              🎉 Nível {levelUpMsg.nivel} atingido!
            </div>
            {levelUpMsg.uniko
              ? <div style={{fontSize:13,color:T.text}}>
                  <strong>{levelUpMsg.uniko.name}</strong> desbloqueado!
                  <span style={{fontSize:11,color:T.textT,display:'block',marginTop:2}}>
                    {levelUpMsg.uniko.title} · Raridade Comum
                  </span>
                </div>
              : <div style={{fontSize:13,color:T.textS}}>Continue interagindo para desbloquear mais!</div>
            }
          </div>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{fontSize:22,fontWeight:600,color:T.text}}>My Uniko</div>
            <div style={{padding:'3px 10px',borderRadius:8,
              background:`${T.gold}22`,border:`1px solid ${T.goldLine}55`,
              fontSize:12,fontWeight:700,color:T.gold,letterSpacing:'.04em'}}>
              Nv. {nivel}
            </div>
          </div>
          <div style={{fontSize:15,color:T.textT,marginTop:4}}>
            Seu companheiro virtual —{' '}
            <span style={{color:activeSkin.color,fontWeight:500}}>{activeSkin.label}</span>
          </div>
          {/* Barra de XP */}
          <div style={{marginTop:10,display:'flex',alignItems:'center',gap:10,maxWidth:320}}>
            <div style={{flex:1,height:6,borderRadius:99,
              background:T.surfaceSub||'rgba(0,0,0,0.06)',overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:99,
                background:`linear-gradient(90deg,${T.gold},${T.gold}bb)`,
                width: nivel < XP_LEVELS.length - 1
                  ? `${Math.min(100,((xp - XP_LEVELS[nivel]) / (XP_LEVELS[nivel+1] - XP_LEVELS[nivel])) * 100)}%`
                  : '100%',
                transition:'width .5s ease',
                boxShadow:`0 0 6px ${T.gold}55`}}/>
            </div>
            <div style={{fontSize:11,color:T.textT,flexShrink:0}}>
              {nivel < XP_LEVELS.length - 1
                ? `${xp - XP_LEVELS[nivel]} / ${XP_LEVELS[nivel+1] - XP_LEVELS[nivel]} XP`
                : 'Nível máximo!'}
            </div>
          </div>
        </div>
        <button onClick={()=>setShowColecao(s=>!s)}
          style={{display:'inline-flex',alignItems:'center',gap:7,padding:'8px 16px',
            background:showColecao?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.04)'),
            border:`1px solid ${showColecao?T.goldLine+'55':T.border}`,borderRadius:10,
            color:showColecao?T.gold:T.textS,cursor:'pointer',outline:'none',
            fontFamily:'var(--font-body)',fontSize:13,fontWeight:500,transition:'all .15s'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Coleção
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {showColecao
              ? <polyline points="18 15 12 9 6 15"/>
              : <polyline points="6 9 12 15 18 9"/>}
          </svg>
        </button>
      </div>
      <StarDivider my={16}/>

      {showColecao&&(
        <Card style={{padding:'20px',marginBottom:16}}>
          {/* Dokos — sempre disponíveis */}
          <div style={{fontSize:13,fontWeight:600,color:T.textS,letterSpacing:'.06em',
            textTransform:'uppercase',marginBottom:12}}>Dokos</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:20}}>
            {DOKO_SKINS.map(s=>(
              <div key={s.id}
                onClick={()=>{setSkin(s.id);setShowComidas(false);setConversa(null);
                  setTimeout(()=>dizer(rnd(DOKO_PERSONALIDADES[s.id].saudacao)),100);}}
                style={{cursor:'pointer',borderRadius:14,overflow:'hidden',
                  border:`2.5px solid ${skin===s.id?s.color:'rgba(0,0,0,0.08)'}`,
                  transition:'all .18s',
                  boxShadow:skin===s.id?`0 4px 16px ${s.color}44`:'none',
                  transform:skin===s.id?'scale(1.04)':'scale(1)'}}>
                <img src={s.img} alt={s.label}
                  style={{width:'100%',aspectRatio:'1',objectFit:'cover',display:'block'}}/>
                <div style={{padding:'6px 8px',textAlign:'center',
                  background:skin===s.id?`${s.color}18`:'transparent',
                  fontSize:12,fontWeight:skin===s.id?600:400,
                  color:skin===s.id?s.color:T.textS}}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Unikos comuns — desbloqueados por nível */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:600,color:T.textS,letterSpacing:'.06em',
              textTransform:'uppercase'}}>Raridade Comum</div>
            <div style={{fontSize:11,color:T.textT}}>
              {UNIKO_COMMON.filter(u=>nivel>=u.level).length}/{UNIKO_COMMON.length} desbloqueados
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:10}}>
            {UNIKO_COMMON.map(u=>{
              const desbloqueado = nivel >= u.level;
              const ativo = skin === u.key;
              return(
                <div key={u.key}
                  onClick={()=>{
                    if(!desbloqueado) return;
                    setSkin(u.key);
                    setShowComidas(false);
                    setConversa(null);
                    setTimeout(()=>dizer(`${u.name} entrando em cena! 🎵`),100);
                  }}
                  style={{
                    cursor:desbloqueado?'pointer':'not-allowed',
                    borderRadius:14,overflow:'hidden',
                    border:`2.5px solid ${ativo?T.gold:desbloqueado?T.gold+'44':T.border}`,
                    background:ativo?`${T.gold}12`:desbloqueado?`${T.gold}06`:(T.surfaceSub||'rgba(0,0,0,0.03)'),
                    transition:'all .18s',
                    boxShadow:ativo?`0 4px 16px ${T.gold}44`:'none',
                    transform:ativo?'scale(1.04)':'scale(1)',
                    opacity:desbloqueado?1:0.55}}>
                  <div style={{position:'relative',aspectRatio:'1',overflow:'hidden'}}>
                    <img src={u.img} alt={u.name}
                      style={{width:'100%',height:'100%',objectFit:'cover',display:'block',
                        filter:desbloqueado?'none':'grayscale(1) brightness(.6)'}}/>
                    {!desbloqueado&&(
                      <div style={{position:'absolute',inset:0,display:'flex',
                        flexDirection:'column',alignItems:'center',justifyContent:'center',
                        background:'rgba(0,0,0,0.4)'}}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke="white" strokeWidth="2" strokeLinecap="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                        <div style={{fontSize:10,color:'white',fontWeight:700,marginTop:3}}>Nv. {u.level}</div>
                      </div>
                    )}
                    {ativo&&(
                      <div style={{position:'absolute',top:5,right:5,width:18,height:18,
                        borderRadius:'50%',background:T.gold,display:'flex',
                        alignItems:'center',justifyContent:'center',fontSize:10,color:'white',fontWeight:700}}>✓</div>
                    )}
                  </div>
                  <div style={{padding:'7px 8px',textAlign:'center'}}>
                    <div style={{fontSize:11,fontWeight:ativo?700:500,
                      color:ativo?T.gold:desbloqueado?T.text:T.textT,lineHeight:1.3}}>
                      {u.name}
                    </div>
                    <div style={{fontSize:10,color:desbloqueado?T.gold:T.textT,marginTop:1}}>
                      {desbloqueado?u.title:`🔒 Nível ${u.level}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Seletor de comida */}
      {showComidas&&(
        <div style={{marginBottom:16}}>
          <Card style={{padding:'18px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>O que você vai dar para o Doko?</div>
              <button onClick={()=>setShowComidas(false)}
                style={{background:'none',border:'none',cursor:'pointer',color:T.textT,fontSize:16,padding:'2px 6px'}}>✕</button>
            </div>
            <div style={{marginBottom:10,display:'flex',gap:8,alignItems:'center'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:T.green,flexShrink:0}}/>
              <span style={{fontSize:11,color:T.textT}}>Verde = saudável · </span>
              <div style={{width:8,height:8,borderRadius:'50%',background:T.gold,flexShrink:0}}/>
              <span style={{fontSize:11,color:T.textT}}>Dourado = especial</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {COMIDAS.map(comida=>{
                const cor = comida.saudavel ? T.green : T.gold;
                const Icon = COMIDA_ICONS[comida.cat];
                return(
                  <button key={comida.id} onClick={()=>escolherComida(comida)}
                    style={{display:'flex',flexDirection:'column',alignItems:'center',
                      gap:6,padding:'12px 8px',borderRadius:12,cursor:'pointer',
                      background:`${cor}10`,border:`1.5px solid ${cor}44`,
                      outline:'none',fontFamily:'var(--font-body)',
                      transition:'all .18s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background=`${cor}22`;e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.borderColor=`${cor}88`;}}
                    onMouseLeave={e=>{e.currentTarget.style.background=`${cor}10`;e.currentTarget.style.transform='none';e.currentTarget.style.borderColor=`${cor}44`;}}>
                    <div style={{color:cor}}>{Icon(cor)}</div>
                    <div style={{fontSize:11,fontWeight:500,color:T.text,textAlign:'center',lineHeight:1.3}}>
                      {comida.nome}
                    </div>
                    <div style={{display:'flex',gap:6,fontSize:10,color:T.textT}}>
                      <span style={{color:T.green}}>+{comida.fome} fome</span>
                      {comida.energia>=0
                        ?<span style={{color:T.blue}}>+{comida.energia} en.</span>
                        :<span style={{color:T.danger}}>{comida.energia} en.</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:20}}>

        {/* Doko central — layout fixo sem deslocamento */}
        <Card style={{padding:'28px',display:'flex',flexDirection:'column',
          alignItems:'center',minHeight:480,position:'relative',overflow:'hidden'}} elevated>

          {/* Cenário SVG — cobre toda a área do card, itens ao redor do Doko */}
          {DOKO_SCENES[skin]&&(
            <div style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden',borderRadius:'inherit'}}>
              {React.createElement(DOKO_SCENES[skin],{color:activeSkin.color})}
            </div>
          )}

          {/* Área do balão — altura fixa para não deslocar o Doko */}
          <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:380,
            height:110,display:'flex',alignItems:'center',justifyContent:'center',
            marginBottom:12}}>
            {fala&&(
              <div style={{
                background:T.surface,border:`1.5px solid ${activeSkin.color}55`,
                borderRadius:16,padding:'12px 18px',width:'100%',
                textAlign:'center',boxShadow:`0 4px 16px ${activeSkin.color}22`,
                fontSize:14,color:T.text,lineHeight:1.6,fontStyle:'italic',
                position:'relative',
              }}>
                {fala}
                <div style={{position:'absolute',bottom:-9,left:'50%',
                  transform:'translateX(-50%)',width:0,height:0,
                  borderLeft:'7px solid transparent',borderRight:'7px solid transparent',
                  borderTop:`9px solid ${activeSkin.color}55`}}/>
                <div style={{position:'absolute',bottom:-7,left:'50%',
                  transform:'translateX(-50%)',width:0,height:0,
                  borderLeft:'6px solid transparent',borderRight:'6px solid transparent',
                  borderTop:`8px solid ${T.surface}`}}/>
              </div>
            )}
          </div>

          {/* Doko — completamente estático, apenas o ring pulsa */}
          <div onClick={clicarDoko}
            style={{position:'relative',zIndex:1,cursor:'pointer',marginBottom:14}}>
            <div style={{
              width:230,height:230,borderRadius:'50%',overflow:'hidden',
              border: dormindo
                ? '3px solid rgba(120,100,220,0.6)'
                : isCansado
                  ? `3px solid ${T.danger}88`
                  : `3px solid ${activeSkin.color}${bounce?'BB':'33'}`,
              boxShadow: dormindo
                ? undefined  /* animação CSS cuida do shadow */
                : isCansado
                  ? `0 0 0 6px ${T.danger}33, 0 0 0 12px ${T.danger}11`
                  : bounce
                    ? `0 0 0 7px ${activeSkin.color}44, 0 0 0 14px ${activeSkin.color}18, 0 0 28px 6px ${activeSkin.color}33`
                    : `0 0 0 3px ${activeSkin.color}16`,
              animation: dormindo ? 'dokoSleep 3s ease-in-out infinite' : 'none',
              transition: dormindo ? 'border-color .6s ease' : `box-shadow ${bounceDur}s ease, border-color ${bounceDur}s ease`,
            }}>
              <img src={dokoImg} alt="Doko"
                style={{width:'100%',height:'100%',objectFit:'cover',display:'block',
                  filter:isCansado?'saturate(0.5) brightness(0.8)':'none',
                  transition:'filter .6s ease'}}/>
            </div>
            {/* Overlay de dormindo */}
            {dormindo&&(
              <div style={{position:'absolute',inset:0,borderRadius:'50%',
                background:'rgba(10,15,35,0.55)',display:'flex',alignItems:'center',
                justifyContent:'center',pointerEvents:'none'}}>
                <div style={{textAlign:'center'}}>
                  {['Z','z','z'].map((z,i)=>(
                    <span key={i} style={{
                      display:'block',fontSize:16-i*3,fontWeight:700,
                      color:'rgba(200,220,255,0.9)',lineHeight:1.1,
                      animation:'moonFloat '+(3+i*0.5)+'s ease-in-out infinite',
                      animationDelay:i*0.4+'s',
                      marginLeft:i*4+'px',
                    }}>{z}</span>
                  ))}
                </div>
              </div>
            )}
            {/* mood badge */}
            <div style={{position:'absolute',bottom:2,right:2,
              background:T.surface,
              border:`2px solid ${dormindo?'rgba(120,100,220,0.7)':isCansado?T.danger:barColor((fome+energia)/2)}`,
              borderRadius:999,padding:'3px 10px',
              fontSize:10,fontWeight:600,
              color:dormindo?'rgba(120,100,220,1)':isCansado?T.danger:barColor((fome+energia)/2)}}>
              {dormindo ? 'Dormindo' : isCansado ? 'Cansado!' : moodLabel[mood]}
            </div>
          </div>

          <div style={{position:'relative',zIndex:1,fontSize:12,color:T.textT,marginBottom:10}}>
            Clique no Uniko para ele falar
          </div>

          {/* Notificação de stat baixo */}
          {notif&&(
            <div style={{position:'relative',zIndex:2,
              display:'flex',alignItems:'center',gap:8,
              padding:'10px 16px',marginBottom:8,
              borderRadius:12,
              background: notif.tipo==='fome'
                ? `${T.gold}18`
                : notif.tipo==='energia'
                  ? `${T.blue}18`
                  : `rgba(100,80,200,0.12)`,
              border: `1.5px solid ${
                notif.tipo==='fome'
                  ? T.gold+'55'
                  : notif.tipo==='energia'
                    ? T.blue+'55'
                    : 'rgba(100,80,200,0.35)'
              }`,
              boxShadow:`0 4px 12px rgba(0,0,0,0.08)`}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke={notif.tipo==='fome'?T.gold:notif.tipo==='energia'?T.blue:'rgba(120,100,220,1)'}
                strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{fontSize:13,color:T.text,fontStyle:'italic',lineHeight:1.4}}>
                {notif.msg}
              </span>
            </div>
          )}

          {/* Mensagem de conclusão */}
          {sessaoFim&&(
            <div style={{position:'relative',zIndex:1,
              background:`linear-gradient(135deg,${activeSkin.color}18,${T.surface} 80%)`,
              border:`2px solid ${activeSkin.color}55`,
              borderRadius:14,padding:'14px 18px',marginBottom:8,
              textAlign:'center',
              boxShadow:`0 6px 20px ${activeSkin.color}33`}}>
              <div style={{fontSize:18,marginBottom:6}}>🎉</div>
              <div style={{fontSize:14,fontWeight:600,color:activeSkin.color,marginBottom:4}}>
                Sessão concluída!
              </div>
              <div style={{fontSize:12,color:T.textS,lineHeight:1.6}}>
                Você finalizou todas as perguntas por hoje!
              </div>
              <div style={{fontSize:11,color:T.green,marginTop:6,fontWeight:500}}>
                +35 energia recebida
              </div>
            </div>
          )}

          {/* Typing indicator + mensagem de transição */}
          {typing&&(
            <div style={{position:'relative',zIndex:1,
              display:'flex',alignItems:'center',gap:10,
              background:T.surface,
              border:`1.5px solid ${activeSkin.color}44`,
              borderRadius:16,padding:'12px 18px',
              marginBottom:8,
              boxShadow:`0 4px 14px ${activeSkin.color}22`}}>
              <div style={{display:'flex',gap:5,alignItems:'center'}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{
                    width:8,height:8,borderRadius:'50%',
                    background:activeSkin.color,
                    animation:'dotBounce 1.1s ease-in-out infinite',
                    animationDelay:`${i*0.18}s`,
                  }}/>
                ))}
              </div>
              <span style={{fontSize:13,color:T.textS,fontStyle:'italic'}}>
                Preparando a próxima pergunta...
              </span>
            </div>
          )}

          {/* Opções de resposta */}
          {conversa&&!respondeu&&(
            <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:380}}>
              {/* Barra de progresso corrigida */}
              {sessaoAtiva&&filaTotal>0&&(()=>{
                const atual = filaTotal - fila.length;
                const pct   = Math.round((atual/filaTotal)*100);
                return(
                  <div style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',
                      alignItems:'center',marginBottom:5}}>
                      <span style={{fontSize:10,color:T.textT,letterSpacing:'.07em',
                        textTransform:'uppercase',fontWeight:600}}>Progresso</span>
                      <span style={{fontSize:10,color:activeSkin.color,fontWeight:600}}>
                        {atual}/{filaTotal}
                      </span>
                    </div>
                    <div style={{height:4,background:T.divider,borderRadius:999,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:999,
                        background:`linear-gradient(90deg,${activeSkin.color},${activeSkin.color}99)`,
                        width:`${pct}%`,transition:'width .5s ease'}}/>
                    </div>
                  </div>
                );
              })()}
              {/* Pergunta visível e fixa acima das opções */}
              {pergAtual&&(
                <div style={{
                  background:`${activeSkin.color}12`,
                  border:`1.5px solid ${activeSkin.color}44`,
                  borderRadius:12,padding:'10px 14px',
                  fontSize:13,color:T.text,lineHeight:1.6,
                  fontWeight:500,marginBottom:10,textAlign:'center',
                  fontStyle:'italic'
                }}>
                  {pergAtual}
                </div>
              )}
              <div style={{fontSize:11,color:T.textT,textAlign:'center',marginBottom:8,
                letterSpacing:'.07em',textTransform:'uppercase',fontWeight:600}}>
                Sua resposta:
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {conversa.opcoes.map((op,i)=>(
                  <button key={i} onClick={()=>responderOpcao(op)}
                    style={{padding:'10px 14px',borderRadius:11,cursor:'pointer',
                      fontFamily:'var(--font-body)',fontSize:13,
                      outline:'none',textAlign:'left',
                      background:T.surfaceSub||'rgba(0,0,0,0.025)',
                      border:`1.5px solid ${T.border}`,
                      color:T.text,transition:'all .15s'}}
                    onMouseEnter={e=>{
                      e.currentTarget.style.background=`${activeSkin.color}18`;
                      e.currentTarget.style.borderColor=`${activeSkin.color}66`;
                      e.currentTarget.style.color=activeSkin.color;
                      e.currentTarget.style.transform='translateX(4px)';}}
                    onMouseLeave={e=>{
                      e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.025)';
                      e.currentTarget.style.borderColor=T.border;
                      e.currentTarget.style.color=T.text;
                      e.currentTarget.style.transform='none';}}>
                    {op.t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Painel lateral */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>

          {/* Barras */}
          <Card style={{padding:'22px'}}>
            <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:16}}>
              Estado do Uniko
            </div>
            {[
              {label:'Fome',   val:fome,   d:<path d="M3 11l19-9-9 19-2-8-8-2z"/>},
              {label:'Energia',val:energia,d:<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>},
              {label:'Sono',   val:sono,   d:<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>},
            ].map(({label,val,d})=>(
              <div key={label} style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',
                  alignItems:'center',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,
                    fontSize:13,color:T.textS}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke={barColor(val)} strokeWidth="1.7" strokeLinecap="round">{d}</svg>
                    {label}
                  </div>
                  <span style={{fontSize:13,fontWeight:600,color:barColor(val)}}>
                    {Math.round(val)}%
                  </span>
                </div>
                <div style={{height:8,background:T.surfaceSub||'rgba(0,0,0,0.06)',
                  borderRadius:999,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${val}%`,borderRadius:999,
                    background:`linear-gradient(90deg,${barColor(val)},${barColor(val)}99)`,
                    transition:'width .5s ease',
                    boxShadow:`0 0 6px ${barColor(val)}55`}}/>
                </div>
              </div>
            ))}
            <StarDivider my={8} dim/>
            <div style={{fontSize:12,color:T.textT,textAlign:'center',marginTop:4}}>
              {mood==='feliz'?'Seu Uniko está muito feliz!'
               :mood==='neutro'?'Seu Uniko precisa de atenção'
               :'Seu Uniko precisa de cuidados urgentes!'}
            </div>
          </Card>

          {/* Ações */}
          <Card style={{padding:'22px'}}>
            <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:14}}>
              Interagir
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                {fn:alimentar,       label:'Alimentar',     sub:showComidas?'Escolhendo comida...':'Escolha o que dar · +9 a +18 XP',
                  d:<path d="M3 11l19-9-9 19-2-8-8-2z"/>},
                {fn:carinho,         label:'Fazer Carinho', sub:'Recupera energia +22 · +15 XP',
                  d:<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>},
                {fn:iniciarConversa, label:'Conversar',     sub:`+10 XP/resposta · bônus +20 XP ao completar`,
                  d:<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>},
                {fn:toggleDormir,    label:dormindo?'Acordar':'Colocar pra Dormir',
                  sub:dormindo?`Dormindo... sono ${Math.round(sono)}%`:'Pausa o gasto de energia e fome',
                  d:dormindo
                    ?<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/></>
                    :<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>},
              ].map(({fn,label,sub,d})=>(
                <button key={label} onClick={fn}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',
                    background:`${activeSkin.color}12`,
                    border:`1px solid ${activeSkin.color}33`,
                    borderRadius:12,cursor:'pointer',outline:'none',
                    fontFamily:'var(--font-body)',transition:'all .18s',textAlign:'left'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';
                    e.currentTarget.style.boxShadow=`0 6px 18px ${activeSkin.color}33`;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='none';
                    e.currentTarget.style.boxShadow='none';}}>
                  <div style={{width:38,height:38,borderRadius:10,flexShrink:0,
                    background:`linear-gradient(135deg,${activeSkin.color},${activeSkin.color}aa)`,
                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="white" strokeWidth="1.8" strokeLinecap="round">{d}</svg>
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:500,color:T.text}}>{label}</div>
                    <div style={{fontSize:12,color:T.textT,marginTop:1}}>{sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Dica do Uniko */}
          <div style={{padding:'14px 16px',
            background:`linear-gradient(135deg,${activeSkin.color}14,${T.surface} 80%)`,
            border:`1px solid ${activeSkin.color}33`,borderRadius:12}}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <div style={{width:30,height:30,borderRadius:'50%',overflow:'hidden',
                flexShrink:0,border:`2px solid ${activeSkin.color}55`}}>
                <img src={dokoImg}
                  style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:activeSkin.color,
                  letterSpacing:'.07em',textTransform:'uppercase',marginBottom:4}}>
                  Dica do {activeSkin.label}
                </div>
                <div style={{fontSize:12,color:T.textS,lineHeight:1.6}}>
                  {pers.dicas[Math.floor((Date.now()/60000)%pers.dicas.length)]}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};



export { TabMyDoko };
