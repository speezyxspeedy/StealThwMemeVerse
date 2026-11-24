import React, { useState } from 'react';
import {
  Check,
  Coins,
  Crown,
  EyeOff,
  Gem,
  Gift,
  Heart,
  Lock,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Unlock,
  X,
  Zap,
} from 'lucide-react';
import {
  CREATURE_BY_ID,
  CREATURES,
  formatNumber,
  getCreatureEffectiveIncome,
  getCreatureSellValue,
  MUTATION_META,
  RARITY_META,
} from '../shared/creatures';
import type { RarityTier } from '../shared/types';
import {
  COSMETIC_CATALOG,
  getRebirthRequirement,
  getUpgradeCost,
  LUCKY_BLOCK_TIERS,
  SNEAK_CLOAK_COST_GEMS,
  UPGRADE_CATALOG,
} from '../shared/worldConfig';
import { selectLocalPlayer, useGameStore } from '../store/gameStore';

export const GameModals: React.FC = () => {
  const activeModal = useGameStore((s) => s.activeModal);
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const me = useGameStore(selectLocalPlayer);

  if (activeModal === 'none' || !me) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/65"
      onClick={() => setActiveModal('none')}
    >
      <div
        className="w-full max-w-3xl max-h-[84vh] bg-[#0e1529] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {activeModal === 'inventory' && <InventoryModal />}
        {activeModal === 'shop' && <ShopModal />}
        {activeModal === 'rebirth' && <RebirthModal />}
        {activeModal === 'lucky' && <LuckyModal />}
        {activeModal === 'trade' && <TradeChatModal />}
        {activeModal === 'quests' && <QuestsModal />}
        {activeModal === 'pause' && <PauseModal />}
      </div>
    </div>
  );
};

const ModalHeader: React.FC<{ title: string; subtitle: string; onClose: () => void }> = ({
  title,
  subtitle,
  onClose,
}) => (
  <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0b1020]">
    <div>
      <h2 className="font-display text-xl font-extrabold text-white">{title}</h2>
      <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
    </div>
    <button
      type="button"
      onClick={onClose}
      className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
      aria-label="Close window"
    >
      <X className="w-5 h-5" />
    </button>
  </div>
);

// ================= 1. INVENTORY & 36-CREATURE INDEX =================
const InventoryModal: React.FC = () => {
  const me = useGameStore(selectLocalPlayer)!;
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const sellMemeling = useGameStore((s) => s.sellMemeling);
  const toggleLock = useGameStore((s) => s.toggleMemelingLock);
  const toggleFav = useGameStore((s) => s.toggleMemelingFavorite);
  const fuseMemeling = useGameStore((s) => s.fuseMemeling);

  const [tab, setTab] = useState<'owned' | 'index'>('owned');
  const [rarityFilter, setRarityFilter] = useState<RarityTier | 'All'>('All');
  const maxSlots = Math.min(12, 6 + me.upgrades.baseSlots);

  const countByCreature = new Map<string, number>();
  for (const m of me.memelings) {
    if (!m.locked) countByCreature.set(m.creatureId, (countByCreature.get(m.creatureId) ?? 0) + 1);
  }

  return (
    <>
      <ModalHeader
        title="Memeling Vault & Collection"
        subtitle={`Base Pedestals: ${me.memelings.length} / ${maxSlots} · Discovered: ${me.discoveredIds.length} / ${CREATURES.length}`}
        onClose={() => setActiveModal('none')}
      />

      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-white/10 bg-[#111933]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab('owned')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              tab === 'owned' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            My Base ({me.memelings.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('index')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              tab === 'index' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            Memeling Index ({me.discoveredIds.length}/{CREATURES.length})
          </button>
        </div>

        {tab === 'index' && (
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value as RarityTier | 'All')}
            className="bg-[#0b1020] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
          >
            <option value="All">All Rarities</option>
            {Object.keys(RARITY_META).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="p-5 overflow-y-auto memeverse-scroll flex-1">
        {tab === 'owned' ? (
          me.memelings.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Your pedestals are empty! Head to the Central Conveyor or raid an unlocked rival base.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {me.memelings.map((mem) => {
                const def = CREATURE_BY_ID[mem.creatureId];
                if (!def) return null;
                const rMeta = RARITY_META[def.rarity];
                const mMeta = MUTATION_META[mem.mutation];
                const inc = getCreatureEffectiveIncome(mem.creatureId, mem.mutation, mem.level);
                const sellVal = getCreatureSellValue(mem.creatureId, mem.mutation, mem.level);
                const canFuse = (countByCreature.get(mem.creatureId) ?? 0) >= 2;

                return (
                  <div
                    key={mem.instanceId}
                    className="p-3.5 rounded-xl bg-[#141d38] border border-white/10 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-extrabold text-sm text-slate-950 shrink-0"
                          style={{ backgroundColor: def.primaryColor }}
                        >
                          Lv{mem.level}
                        </div>
                        <div>
                          <div className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                            <span>{def.name}</span>
                            {mem.mutation !== 'normal' && (
                              <span className="text-[11px] font-semibold" style={{ color: mMeta.color }}>
                                · {mMeta.label}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            <span style={{ color: rMeta.color }}>{def.rarity}</span> · Slot #{mem.slotIndex + 1}
                            {mem.stolenFrom ? ` · Stolen from ${mem.stolenFrom}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono-num text-xs font-bold text-emerald-400">
                        +{formatNumber(inc)}/s
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/8">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleFav(mem.instanceId)}
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            mem.favorite
                              ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                          }`}
                          title="Favorite"
                        >
                          <Heart className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleLock(mem.instanceId)}
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            mem.locked
                              ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                          }`}
                          title={mem.locked ? 'Unlock for sell/trade' : 'Lock against accidental sell'}
                        >
                          {mem.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {canFuse && (
                          <button
                            type="button"
                            onClick={() => fuseMemeling(mem.instanceId)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400/50 text-[11px] font-bold text-purple-200 cursor-pointer"
                          >
                            Fuse +Lv
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={mem.locked}
                          onClick={() => sellMemeling(mem.instanceId)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/30 text-[11px] font-bold text-rose-200 disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Sell {formatNumber(sellVal)}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {CREATURES.filter((c) => rarityFilter === 'All' || c.rarity === rarityFilter).map((def) => {
              const discovered = me.discoveredIds.includes(def.id);
              const rMeta = RARITY_META[def.rarity];
              return (
                <div
                  key={def.id}
                  className={`p-3 rounded-xl border ${
                    discovered ? 'bg-[#141d38] border-white/12' : 'bg-[#0b1020] border-white/5 opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm text-white truncate">
                      {discovered ? def.name : '???'}
                    </span>
                    <span className="text-[11px] font-bold shrink-0" style={{ color: rMeta.color }}>
                      {def.rarity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    {discovered ? def.tagline : 'Collect from Conveyor, Heists, or Lucky Blocks'}
                  </p>
                  <div className="flex items-center justify-between text-[11px] font-mono-num mt-2 pt-2 border-t border-white/8">
                    <span className="text-amber-300">{formatNumber(def.price)} Coins</span>
                    <span className="text-emerald-400">+{formatNumber(def.incomePerSec)}/s</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

// ================= 2. UPGRADE, COSMETIC & HEIST GEAR SHOP =================
const ShopModal: React.FC = () => {
  const me = useGameStore(selectLocalPlayer)!;
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const buyUpgrade = useGameStore((s) => s.buyUpgrade);
  const buyOrEquipCosmetic = useGameStore((s) => s.buyOrEquipCosmetic);
  const activateSneakCloak = useGameStore((s) => s.activateSneakCloak);

  const [tab, setTab] = useState<'upgrades' | 'cosmetics' | 'heist'>('upgrades');

  return (
    <>
      <ModalHeader
        title="Memeverse Upgrade & Gear Shop"
        subtitle={`Wallet: ${formatNumber(me.coins)} Coins · ${formatNumber(me.gems)} Gems`}
        onClose={() => setActiveModal('none')}
      />

      <div className="flex items-center gap-1.5 px-6 py-3 border-b border-white/10 bg-[#111933]">
        {(
          [
            ['upgrades', 'Base & Gear Upgrades'],
            ['cosmetics', 'Skins & Base Themes'],
            ['heist', 'Heist Gadgets & VIP'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              tab === key ? 'bg-emerald-400 text-slate-950' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-5 overflow-y-auto memeverse-scroll flex-1">
        {tab === 'upgrades' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {UPGRADE_CATALOG.map((u) => {
              const lvl = me.upgrades[u.key];
              const isMax = lvl >= u.maxLevel;
              const cost = getUpgradeCost(u.key, lvl);
              const canAfford = me.coins >= cost;
              return (
                <div
                  key={u.key}
                  className="p-4 rounded-xl bg-[#141d38] border border-white/10 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-sm text-white">{u.name}</span>
                      <span className="font-mono-num text-xs font-bold text-sky-300">
                        Lv.{lvl}/{u.maxLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{u.description}</p>
                    <div className="text-[11px] font-semibold text-emerald-400 mt-1.5">{u.effectPerLevel}</div>
                  </div>
                  <button
                    type="button"
                    disabled={isMax || !canAfford}
                    onClick={() => buyUpgrade(u.key)}
                    className={`w-full py-2 px-4 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      isMax
                        ? 'bg-slate-800 text-slate-400'
                        : canAfford
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                          : 'bg-white/8 text-slate-400'
                    }`}
                  >
                    {isMax ? 'Max Level Reached' : `Upgrade · ${formatNumber(cost)} Coins`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'cosmetics' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {COSMETIC_CATALOG.map((item) => {
              const unlocked =
                item.category === 'skin'
                  ? me.unlockedSkins.includes(item.id)
                  : me.unlockedThemes.includes(item.id);
              const equipped =
                item.category === 'skin' ? me.skinId === item.id : me.baseTheme === item.id;

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[#141d38] border border-white/10 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl border-2 shrink-0"
                      style={{ backgroundColor: item.color, borderColor: item.accent }}
                    />
                    <div>
                      <div className="font-display font-bold text-sm text-white">{item.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {item.category === 'skin' ? 'Avatar Skin' : 'Base Theme'} · {item.tag}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => buyOrEquipCosmetic(item.id)}
                    className={`w-full py-2 rounded-lg text-xs font-bold cursor-pointer ${
                      equipped
                        ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-200'
                        : unlocked
                          ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                          : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                  >
                    {equipped ? 'Equipped' : unlocked ? 'Equip' : `Unlock · ${item.gemCost} Gems`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'heist' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-[#141d38] border border-purple-400/35 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-purple-300 font-display font-bold text-base">
                  <EyeOff className="w-5 h-5" />
                  <span>Phantom Sneak Cloak</span>
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Turn invisible to rival players for 14 seconds so you can slip into unlocked bases undetected and snatch their rarest Memelings!
                </p>
              </div>
              <button
                type="button"
                disabled={me.gems < SNEAK_CLOAK_COST_GEMS}
                onClick={activateSneakCloak}
                className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 disabled:opacity-45 text-white font-bold text-xs cursor-pointer"
              >
                Activate Cloak · {SNEAK_CLOAK_COST_GEMS} Gems
              </button>
            </div>

            <div className="p-5 rounded-xl bg-[#141d38] border border-amber-400/30 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-300 font-display font-bold text-base">
                  <Crown className="w-5 h-5" />
                  <span>VIP & Game Pass Architecture</span>
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Cosmetic passes, VIP Plaza multipliers, and premium gem bundles are architected server-side. Real-money checkout is intentionally disabled in this live sandbox — earn Gems free via Quests, Rebirths, Daily Rewards, and the Sky Obby Chest!
                </p>
              </div>
              <div className="text-xs font-semibold text-amber-200/90 bg-amber-500/10 border border-amber-400/25 rounded-lg px-3 py-2">
                Tip: Climb the Sky Obby pads behind the Lucky Zone for +8 free Gems every 90s!
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ================= 3. REBIRTH SANCTUARY =================
const RebirthModal: React.FC = () => {
  const me = useGameStore(selectLocalPlayer)!;
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const performRebirth = useGameStore((s) => s.performRebirth);
  const req = getRebirthRequirement(me.rebirths);
  const canRebirth = me.coins >= req.coinCost;

  return (
    <>
      <ModalHeader
        title="Rebirth Sanctuary"
        subtitle="Ascend your Memeverse empire for permanent multipliers and bonus Gems."
        onClose={() => setActiveModal('none')}
      />
      <div className="p-6 flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-[#141d38] border border-white/10">
            <div className="text-xs text-slate-400">Current Rebirth</div>
            <div className="font-mono-num text-2xl font-extrabold text-white mt-1">
              Tier {me.rebirths}
            </div>
            <div className="text-xs text-amber-300 mt-1">{me.rebirthMultiplier}x Income Multiplier</div>
          </div>
          <div className="p-4 rounded-xl bg-[#141d38] border border-amber-400/35">
            <div className="text-xs text-slate-400">Next Permanent Boost</div>
            <div className="font-mono-num text-2xl font-extrabold text-amber-300 mt-1">
              {req.nextMultiplier}x
            </div>
            <div className="text-xs text-sky-300 mt-1">+{req.gemReward} Bonus Gems</div>
          </div>
          <div className="p-4 rounded-xl bg-[#141d38] border border-white/10">
            <div className="text-xs text-slate-400">Required Coins</div>
            <div className="font-mono-num text-2xl font-extrabold text-emerald-400 mt-1">
              {formatNumber(req.coinCost)}
            </div>
            <div className="text-xs text-slate-300 mt-1">You have {formatNumber(me.coins)}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b1020] border border-white/10 text-xs text-slate-300 leading-relaxed">
          Rebirthing resets your Coins and extra Memelings, while <strong className="text-white">preserving your highest-rarity heirloom Memeling, all Upgrades, Skins, Gems, and Collection Index</strong> — and grants a permanent <strong className="text-amber-300">+0.75x income multiplier</strong>!
        </div>

        <button
          type="button"
          disabled={!canRebirth}
          onClick={performRebirth}
          className={`w-full py-3.5 rounded-xl font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors ${
            canRebirth
              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              : 'bg-slate-800 text-slate-400 cursor-not-allowed'
          }`}
        >
          <RotateCcw className="w-5 h-5" />
          <span>{canRebirth ? `Ascend to Rebirth ${me.rebirths + 1}` : `Need ${formatNumber(req.coinCost - me.coins)} more Coins`}</span>
        </button>
      </div>
    </>
  );
};

// ================= 4. LUCKY BLOCK UNBOXER =================
const LuckyModal: React.FC = () => {
  const me = useGameStore(selectLocalPlayer)!;
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const openLuckyBlock = useGameStore((s) => s.openLuckyBlock);
  const lastLuckyResult = useGameStore((s) => s.lastLuckyResult);
  const clearLuckyResult = useGameStore((s) => s.clearLuckyResult);

  const revealedDef = lastLuckyResult ? CREATURE_BY_ID[lastLuckyResult.creatureId] : null;
  const revealedRarity = revealedDef ? RARITY_META[revealedDef.rarity] : null;
  const revealedMut = lastLuckyResult ? MUTATION_META[lastLuckyResult.mutation] : null;

  return (
    <>
      <ModalHeader
        title="Lucky Block Zone"
        subtitle="Crack server-rolled mystery crates for mutated Rare, Mythic, Secret & Celestial Memelings."
        onClose={() => {
          clearLuckyResult();
          setActiveModal('none');
        }}
      />

      <div className="p-6 flex flex-col gap-5 overflow-y-auto memeverse-scroll">
        {lastLuckyResult && revealedDef && revealedRarity && revealedMut && (
          <div
            className="p-5 rounded-2xl bg-[#141d38] border-2 flex items-center justify-between gap-4"
            style={{ borderColor: revealedRarity.color }}
          >
            <div>
              <div className="text-xs font-extrabold tracking-wide" style={{ color: revealedRarity.color }}>
                UNBOXED {revealedMut.type !== 'normal' ? `${revealedMut.label.toUpperCase()} ` : ''}
                {revealedDef.rarity.toUpperCase()}!
              </div>
              <div className="font-display text-2xl font-extrabold text-white mt-0.5">
                {revealedDef.name}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {lastLuckyResult.addedToBase
                  ? `Placed on your base! +${formatNumber(lastLuckyResult.bonusCoins)} bonus Coins`
                  : `Base full — converted for +${formatNumber(lastLuckyResult.bonusCoins)} Coins`}
              </div>
            </div>
            <button
              type="button"
              onClick={clearLuckyResult}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
            >
              Nice!
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {(['basic', 'epic', 'celestial'] as const).map((tierKey) => {
            const spec = LUCKY_BLOCK_TIERS[tierKey];
            const canAfford =
              (spec.costCoins === 0 || me.coins >= spec.costCoins) &&
              (spec.costGems === 0 || me.gems >= spec.costGems);
            return (
              <div
                key={tierKey}
                className="p-4 rounded-xl bg-[#141d38] border border-white/12 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 font-display font-bold text-base text-white">
                    <Sparkles className="w-4 h-4" style={{ color: spec.color }} />
                    <span>{spec.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{spec.description}</p>
                </div>
                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => openLuckyBlock(tierKey)}
                  className="w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-colors disabled:opacity-40"
                  style={{ backgroundColor: spec.color, color: '#0b1020' }}
                >
                  {spec.costCoins > 0
                    ? `Open · ${formatNumber(spec.costCoins)} Coins`
                    : `Open · ${spec.costGems} Gems`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

// ================= 5. TRADING & GLOBAL CHAT =================
const TradeChatModal: React.FC = () => {
  const me = useGameStore(selectLocalPlayer)!;
  const players = useGameStore((s) => s.players);
  const chat = useGameStore((s) => s.chat);
  const activeTrade = useGameStore((s) => s.activeTrade);
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const requestTrade = useGameStore((s) => s.requestTrade);
  const acceptTrade = useGameStore((s) => s.acceptTrade);
  const toggleTradeItem = useGameStore((s) => s.toggleTradeItem);
  const toggleTradeReady = useGameStore((s) => s.toggleTradeReady);
  const cancelTrade = useGameStore((s) => s.cancelTrade);
  const sendChat = useGameStore((s) => s.sendChat);

  const [msg, setMsg] = useState('');
  const humanOthers = players.filter((p) => !p.isBot && p.id !== me.id);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) return;
    sendChat(msg);
    setMsg('');
  };

  return (
    <>
      <ModalHeader
        title="Trading Plaza & Global Chat"
        subtitle="Server-validated atomic Memeling swaps and live plaza chat."
        onClose={() => setActiveModal('none')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 flex-1 overflow-hidden">
        {/* Left: Trade Area */}
        <div className="p-4 flex flex-col gap-3 overflow-y-auto memeverse-scroll">
          <div className="text-xs font-bold text-slate-300">Player-to-Player Trading</div>

          {activeTrade ? (
            <div className="p-3.5 rounded-xl bg-[#141d38] border border-emerald-400/40 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>
                  {activeTrade.fromPlayerName} ↔ {activeTrade.toPlayerName}
                </span>
                <span className="text-emerald-300 uppercase">{activeTrade.status}</span>
              </div>

              {activeTrade.status === 'pending' ? (
                <div className="flex gap-2">
                  {activeTrade.toPlayerId === me.id && (
                    <button
                      type="button"
                      onClick={() => acceptTrade(activeTrade.id)}
                      className="flex-1 py-2 rounded-lg bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Accept Trade
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => cancelTrade(activeTrade.id)}
                    className="flex-1 py-2 rounded-lg bg-rose-500/20 text-rose-200 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-[11px] text-slate-400">Select unlocked Memelings to offer (max 4):</div>
                  <div className="flex flex-wrap gap-1.5">
                    {me.memelings
                      .filter((m) => !m.locked)
                      .map((m) => {
                        const def = CREATURE_BY_ID[m.creatureId];
                        const myOffer =
                          activeTrade.fromPlayerId === me.id
                            ? activeTrade.fromInstanceIds
                            : activeTrade.toInstanceIds;
                        const selected = myOffer.includes(m.instanceId);
                        return (
                          <button
                            key={m.instanceId}
                            type="button"
                            onClick={() => toggleTradeItem(activeTrade.id, m.instanceId)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                              selected
                                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                                : 'bg-white/5 border-white/10 text-slate-300'
                            }`}
                          >
                            {def?.name}
                          </button>
                        );
                      })}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => toggleTradeReady(activeTrade.id)}
                      className="flex-1 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      {(activeTrade.fromPlayerId === me.id ? activeTrade.fromReady : activeTrade.toReady)
                        ? 'Ready! (Click to Unready)'
                        : 'Confirm Ready'}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelTrade(activeTrade.id)}
                      className="px-3 py-2 rounded-lg bg-rose-500/20 text-rose-200 font-bold text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : humanOthers.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#0b1020] border border-white/8 text-xs text-slate-400 leading-relaxed">
              No other human players are currently online in this lobby. Open the game URL in another browser tab to test live multiplayer movement, raiding, and atomic trading!
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {humanOthers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#141d38] border border-white/10"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.avatarColor }} />
                    <span className="text-xs font-bold text-white">{p.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestTrade(p.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Trade
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Global Live Chat */}
        <div className="p-4 flex flex-col gap-3 h-[340px] md:h-[420px]">
          <div className="text-xs font-bold text-slate-300">Live Plaza Chat</div>
          <div className="flex-1 overflow-y-auto memeverse-scroll flex flex-col gap-1.5 pr-1">
            {chat.map((c) => (
              <div key={c.id} className="text-xs leading-relaxed">
                <span
                  className="font-bold mr-1.5"
                  style={{ color: c.accent ?? (c.isSystem ? '#38bdf8' : '#f8fafc') }}
                >
                  {c.senderName}:
                </span>
                <span className={c.isSystem ? 'text-slate-300' : 'text-slate-100'}>{c.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              maxLength={140}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Say something to the plaza..."
              className="flex-1 px-3 py-2 rounded-lg bg-[#0b1020] border border-white/15 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

// ================= 6. QUESTS & DAILY REWARDS =================
const QuestsModal: React.FC = () => {
  const me = useGameStore(selectLocalPlayer)!;
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const claimQuest = useGameStore((s) => s.claimQuest);
  const claimDaily = useGameStore((s) => s.claimDaily);

  return (
    <>
      <ModalHeader
        title="Quests & Daily Rewards"
        subtitle={`Daily Streak: Day ${me.dailyStreak} · Complete missions for free Coins & Gems`}
        onClose={() => setActiveModal('none')}
      />
      <div className="p-5 overflow-y-auto memeverse-scroll flex flex-col gap-4">
        <div className="p-4 rounded-xl bg-[#141d38] border border-amber-400/35 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Gift className="w-7 h-7 text-amber-400 shrink-0" />
            <div>
              <div className="font-display font-bold text-sm text-white">Daily Login Bonus</div>
              <div className="text-xs text-slate-300">
                Streak Day {me.dailyStreak + 1} · Scales with your Rebirth tier!
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={claimDaily}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer shrink-0"
          >
            Claim Daily
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {me.quests.map((q) => {
            const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100));
            const done = q.progress >= q.target;
            return (
              <div
                key={q.id}
                className="p-4 rounded-xl bg-[#141d38] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="font-display font-bold text-sm text-white">{q.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{q.description}</div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono-num text-[11px] text-slate-300">
                      {formatNumber(q.progress)}/{formatNumber(q.target)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right font-mono-num text-[11px]">
                    <div className="text-amber-300">+{formatNumber(q.rewardCoins)} Coins</div>
                    <div className="text-sky-300">+{q.rewardGems} Gems</div>
                  </div>
                  <button
                    type="button"
                    disabled={q.claimed || !done}
                    onClick={() => claimQuest(q.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                      q.claimed
                        ? 'bg-slate-800 text-slate-500'
                        : done
                          ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                          : 'bg-white/5 text-slate-500'
                    }`}
                  >
                    {q.claimed ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Done
                      </span>
                    ) : done ? (
                      'Claim'
                    ) : (
                      'Active'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

// ================= 7. PAUSE & CONTROLS =================
const PauseModal: React.FC = () => {
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const teleportHome = useGameStore((s) => s.teleportHome);
  const muted = useGameStore((s) => s.muted);
  const toggleMute = useGameStore((s) => s.toggleMute);

  return (
    <>
      <ModalHeader
        title="Game Menu & Controls"
        subtitle="The shared multiplayer world continues running in real time."
        onClose={() => setActiveModal('none')}
      />
      <div className="p-6 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          {[
            ['WASD / Arrows', 'Move character'],
            ['Mouse Drag', 'Orbit 3D camera'],
            ['Scroll Wheel', 'Zoom camera'],
            ['Space', 'Jump / Climb Obby'],
            ['Shift', 'Sprint'],
            ['E', 'Buy / Steal / Interact'],
            ['L', 'Activate Base Laser Shield'],
            ['B', 'Teleport Home to Base'],
            ['I', 'Open Memeling Inventory'],
            ['H', 'Hide / Show HUD (Zen)'],
          ].map(([k, desc]) => (
            <div key={k} className="flex items-center justify-between p-2.5 rounded-lg bg-[#141d38] border border-white/8">
              <span className="font-mono-num font-bold text-amber-300">{k}</span>
              <span className="text-slate-300">{desc}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setActiveModal('none')}
            className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm cursor-pointer"
          >
            Resume Game
          </button>
          <button
            type="button"
            onClick={() => {
              teleportHome();
              setActiveModal('none');
            }}
            className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs cursor-pointer"
          >
            Teleport Home
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs cursor-pointer"
          >
            {muted ? 'Unmute Audio' : 'Mute Audio'}
          </button>
        </div>
      </div>
    </>
  );
};

export const _iconKeep = [Coins, Gem, Shield, Zap];
