-- CreateTable
CREATE TABLE "PendingCommand" (
    "id" SERIAL NOT NULL,
    "command" TEXT NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pixCode" TEXT,
    "qrCode" TEXT,
    "checkoutUrl" TEXT,
    "price" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VipOrder" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "vipGroup" TEXT NOT NULL DEFAULT 'vip1',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "notifiedAdd" BOOLEAN NOT NULL DEFAULT false,
    "notifiedDel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VipOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSONB NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "PlayerWeaponSkin" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "weaponName" TEXT NOT NULL,
    "paintKit" INTEGER NOT NULL DEFAULT 0,
    "wearFloat" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "statTrak" BOOLEAN NOT NULL DEFAULT false,
    "statTrakCount" INTEGER NOT NULL DEFAULT 0,
    "nameTag" TEXT NOT NULL DEFAULT '',
    "seed" INTEGER NOT NULL DEFAULT -1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerWeaponSkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGlove" (
    "steamId" TEXT NOT NULL,
    "tGroup" INTEGER NOT NULL DEFAULT 0,
    "tGlove" INTEGER NOT NULL DEFAULT 0,
    "tFloat" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ctGroup" INTEGER NOT NULL DEFAULT 0,
    "ctGlove" INTEGER NOT NULL DEFAULT 0,
    "ctFloat" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerGlove_pkey" PRIMARY KEY ("steamId")
);

-- CreateIndex
CREATE INDEX "VipOrder_steamId_idx" ON "VipOrder"("steamId");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");

-- CreateIndex
CREATE INDEX "PlayerWeaponSkin_steamId_idx" ON "PlayerWeaponSkin"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerWeaponSkin_steamId_weaponName_key" ON "PlayerWeaponSkin"("steamId", "weaponName");
