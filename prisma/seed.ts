import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpando templates antigos...');
  await prisma.questTemplate.deleteMany();

  console.log('🌱 Semeando novos templates da Economia Avalon...');

 const templates = [
    // daily
    {
      tier: 'DAILY',
      type: 'ZOMBIE_DAMAGE',
      eventName: 'player_hurt', 
      useridField: 'attacker', 
      titles: ['Patrulha Diária', 'Aquecimento', 'Controle de Infecção', 'Fogo de Supressão'],
      descriptions: [
        'Mantenha os zumbis afastados causando um total de {TARGET} de dano.',
        'Cause {TARGET} de dano consistente para ajudar a equipe a recuar com segurança.'
      ],
      minTarget: 50000,
      maxTarget: 120000,
      minReward: 500,
      maxReward: 1500,
      baseConditions: [{ field: 'userid', value: 't' }, { field: 'attacker', value: 'ct' }]
    },
    {
      tier: 'DAILY',
      type: 'ZOMBIE_TANK',
      eventName: 'player_hurt',
      useridField: 'userid',
      titles: ['Escudo de Carne', 'Vanguarda Morta-Viva', 'Pele de Chumbo'],
      descriptions: [
        'Absorva {TARGET} de dano dos humanos para ajudar os zumbis a avançarem.',
        'Seja a linha de frente da horda tankando um total de {TARGET} de dano.'
      ],
      minTarget: 15000,
      maxTarget: 40000,
      minReward: 400,
      maxReward: 700,
      baseConditions: [{ field: 'userid', value: 't' }, { field: 'attacker', value: 'ct' }]
    },
    {
      tier: 'DAILY',
      type: 'ZOMBIE_INFECT', 
      eventName: 'zr_infect',
      useridField: null,
      titles: ['Paciente Zero', 'Zumbi Novato', 'Espalhando a Praga'],
      descriptions: [
        'Espalhe o vírus infectando {TARGET} humanos diferentes hoje.',
        'Sua missão é clara: consiga {TARGET} infecções com sucesso.'
      ],
      minTarget: 5,   
      maxTarget: 15,
      minReward: 300,
      maxReward: 500,
      baseConditions: [{ "field": "userid", "value": "ct" }, { "field": "attacker", "value": "t" }]
    },
    {
      tier: 'DAILY',
      type: 'ROUNDS_SURVIVED',
      eventName: 'round_end',
      useridField: null,
      titles: ['O Sobrevivente', 'Fuga Perfeita', 'Instinto de Preservação'],
      descriptions: [
        'Evite a infecção e sobreviva {TARGET} rodadas.',
        'Chegue vivo ao final do mapa como humano por {TARGET} rounds.'
      ],
      minTarget: 3,   
      maxTarget: 8,
      minReward: 100,
      maxReward: 250,
      baseConditions: []
    },
    {
      tier: 'DAILY',
      type: 'BOSS_DAMAGE',
      eventName: 'boss_hit',    // ADICIONADO
      useridField: 'attacker',  // ADICIONADO
      titles: ['Caça Menor', 'Teste de Mira', 'Foco no Gigante'],
      descriptions: [
        'Acerte {TARGET} tiros precisos (hits) nos chefes dos mapas para pontuar.',
        'Ajude a derrubar as ameaças maiores atingindo o boss {TARGET} vezes.'
      ],
      minTarget: 200,
      maxTarget: 500,
      minReward: 800,
      maxReward: 2000,
      baseConditions: []
    },
    {
      tier: 'DAILY',
      type: 'PLAYTIME',
      eventName: 'playtime',    // ADICIONADO
      useridField: 'userid',    // ADICIONADO
      titles: ['Presença Confirmada', 'Soldado Leal', 'Bater o Ponto'],
      descriptions: [
        'Sobreviva por {TARGET} minutos e jogue nos nossos servidores hoje.',
        'Acumule {TARGET} minutos de tempo de serviço ativo para receber sua recompensa.'
      ],
      minTarget: 45,
      maxTarget: 120,
      minReward: 300,
      maxReward: 800,
      baseConditions: []
    },

    // weekly
    {
      tier: 'WEEKLY',
      type: 'ZOMBIE_DAMAGE',
      eventName: 'player_hurt', // ADICIONADO
      useridField: 'attacker',  // ADICIONADO
      titles: ['Veterano da Semana', 'Chacina Constante', 'Muralha Humana', 'O Exterminador'],
      descriptions: [
        'Prove seu valor segurando as hordas e acumulando {TARGET} de dano nesta semana.',
        'Elimine a ameaça zumbi causando um total de {TARGET} de dano total.'
      ],
      minTarget: 400000,
      maxTarget: 800000,
      minReward: 1000,
      maxReward: 3500,
      baseConditions: [{ field: 'userid', value: 't' }, { field: 'attacker', value: 'ct' }]
    },
    {
      tier: 'DAILY',
      type: 'ZOMBIE_TANK',
      eventName: 'player_hurt',
      useridField: 'userid',
      titles: ['Escudo de Carne', 'Vanguarda Morta-Viva', 'Pele de Chumbo'],
      descriptions: [
        'Absorva {TARGET} de dano dos humanos para ajudar os zumbis a avançarem.',
        'Seja a linha de frente da horda tankando um total de {TARGET} de dano.'
      ],
      minTarget: 15000,
      maxTarget: 40000,
      minReward: 600,
      maxReward: 1200,
      baseConditions: [{ field: 'userid', value: 't' }, { field: 'attacker', value: 'ct' }]
    },
    {
      tier: 'DAILY',
      type: 'ZOMBIE_INFECT', 
      eventName: 'zr_infect',
      useridField: null,
      titles: ['Paciente Zero', 'Fome Insaciável', 'Espalhando a Praga'],
      descriptions: [
        'Espalhe o vírus infectando {TARGET} humanos diferentes hoje.',
        'Sua missão é clara: consiga {TARGET} infecções com sucesso.'
      ],
      minTarget: 5,  
      maxTarget: 15,
      minReward: 800,
      maxReward: 2000,
      baseConditions: []
    },
    {
      tier: 'WEEKLY',
      type: 'ROUNDS_SURVIVED',
      eventName: 'round_end',
      useridField: null,
      titles: ['O Sobrevivente', 'Fuga Perfeita', 'Sobrevivente Experiente'],
      descriptions: [
        'Evite a infecção e sobreviva a {TARGET} rounds até o resgate.',
        'Chegue vivo ao final do mapa como humano por {TARGET} rounds.'
      ],
      minTarget: 17,   
      maxTarget: 38,
      minReward: 1000,
      maxReward: 2500,
      baseConditions: []
    },
    {
      tier: 'WEEKLY',
      type: 'BOSS_DAMAGE',
      eventName: 'boss_hit',   
      useridField: 'attacker',  
      titles: ['Assassino de Titãs', 'Exterminador de Bosses', 'Fuzilamento Pesado'],
      descriptions: [
        'Mostre que nenhum boss sobrevive ao seu spray atingindo-os {TARGET} vezes.',
        'Derrube os grandes alvos da semana acumulando {TARGET} hits em bosses.'
      ],
      minTarget: 1500,
      maxTarget: 3500,
      minReward: 1600,
      maxReward: 3000,
      baseConditions: []
    },
    {
      tier: 'WEEKLY',
      type: 'PLAYTIME',
      eventName: 'playtime',    // ADICIONADO
      useridField: 'userid',    // ADICIONADO
      titles: ['Maratona Avalon', 'Jogador Assíduo', 'Sempre Alerta'],
      descriptions: [
        'Dedique {TARGET} minutos de jogo ao servidor durante esta semana.',
        'Mantenha sua constância acumulando um total de {TARGET} minutos jogados.'
      ],
      minTarget: 420,
      maxTarget: 840,
      minReward: 2000,
      maxReward: 3300,
      baseConditions: []
    },

    // monthly
    {
      tier: 'MONTHLY',
      type: 'ZOMBIE_DAMAGE',
      eventName: 'player_hurt', // ADICIONADO
      useridField: 'attacker',  // ADICIONADO
      titles: ['A Lenda Viva', 'Inquisidor da Avalon', 'Máquina de Matar'],
      descriptions: [
        'Alcance a marca de {TARGET} de dano em zumbis durante este mês.',
        'Sua jornada mensal exige um total de {TARGET} de dano causado à horda.'
      ],
      minTarget: 2000000,
      maxTarget: 4000000,
      minReward: 4000,
      maxReward: 9000,
      baseConditions: [{ field: 'userid', value: 't' }, { field: 'attacker', value: 'ct' }]
    },
    {
      tier: 'MONTHLY',
      type: 'ZOMBIE_TANK',
      eventName: 'player_hurt',
      useridField: 'userid',
      titles: ['Muralha da Horda', 'Imortal do Avalon', 'Pesadelo Blindado'],
      descriptions: [
        'Demonstre resistência absoluta absorvendo {TARGET} de dano total neste mês.',
        'Sua missão é ser o escudo da horda: bloqueie {TARGET} de dano vindo dos humanos.'
      ],
      minTarget: 800000,   // 800k de dano absorvido
      maxTarget: 2900000,  // 2.9M de dano absorvido
      minReward: 7000,
      maxReward: 18000,
      baseConditions: [{ field: 'userid', value: 't' }, { field: 'attacker', value: 'ct' }]
    },

    {
      tier: 'MONTHLY',
      type: 'ZOMBIE_INFECT',
      eventName: 'zr_infect',
      useridField: null,
      titles: ['Vetor Supremo', 'Apocalipse Global', 'Ceifador de Almas'],
      descriptions: [
        'Lidere a extinção humana espalhando o vírus para {TARGET} sobreviventes.',
        'Consolide seu legado como o infector mestre com {TARGET} contágios este mês.'
      ],
      minTarget: 150,      // 150 infecções no mês
      maxTarget: 400,      // 400 infecções no mês
      minReward: 10000,
      maxReward: 25000,
      baseConditions: []
    },
    {
      tier: 'MONTHLY',
      type: 'ROUNDS_SURVIVED',
      eventName: 'round_end',
      useridField: null,
      titles: ['Lenda da Fuga', 'Invicto do Avalon', 'Mestre da Sobrevivência'],
      descriptions: [
        'Apenas os melhores chegam ao fim. Sobreviva a {TARGET} rounds vitoriosos este mês.',
        'Garanta sua posição na elite dos humanos escapando com vida {TARGET} vezes.'
      ],
      minTarget: 60,       // Média de 2 fugas por dia
      maxTarget: 150,      // Média de 5 fugas por dia
      minReward: 7000,
      maxReward: 19000,
      baseConditions: []
    }
  ];

  for (const t of templates) {
    await prisma.questTemplate.create({ data: t });
  }

  console.log(`✅ ${templates.length} Templates inseridos com sucesso!`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });