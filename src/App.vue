<template>
  <div class="container">
    <h1>Token Locker</h1>
    
    <!-- Address Input -->
    <div class="address-input">
      <div class="input-header">
        <button @click="showInstructions = true" class="info-button">ℹ️ How to Use</button>
      </div>
      <div class="input-row">
        <input
          type="text"
          v-model="targetAddress"
          placeholder="Enter address (client|...)"
          class="input"
          :class="{ 'input-error': addressError }"
        />
        <button 
          @click="fetchTokens"
          :disabled="!!addressError || !targetAddress || isLoading"
          class="button"
        >
          {{ isLoading ? 'Loading...' : 'Fetch Tokens' }}
        </button>
      </div>
      <p v-if="addressError" class="error-text">{{ addressError }}</p>
    </div>

    <!-- Instructions Modal -->
    <div v-if="showInstructions" class="modal-overlay" @click="showInstructions = false">
      <div class="modal-content" @click.stop>
        <h2>How to Use Token Locker</h2>
        <ol>
          <li>Get your Gala address from the platform (format: client|...)</li>
          <li>Import your Gala wallet seed phrase to MetaMask</li>
          <li>Enter your Gala address into the input box above</li>
          <li>Connect MetaMask using the "Connect Wallet" button</li>
          <li>Unlock or lock tokens by clicking the lock or unlock buttons</li>
        </ol>
        <button @click="showInstructions = false" class="button">Close</button>
      </div>
    </div>

    <!-- Wallet Connection -->
    <div class="wallet-section">
      <button @click="connectWallet" v-if="!isConnected" class="button">Connect Wallet</button>
      <p v-else class="wallet-address">Connected: {{ truncatedAddress }}</p>
    </div>

    <!-- Token List -->
    <div v-if="isConnected" class="token-section">
      <div class="token-list">
        <div 
          v-for="token in sortedTokens" 
          :key="token.id"
          class="token-item"
          :class="{ 
            'token-locked': token.isLocked,
            'selected': selectedToken?.id === token.id 
          }"
          @click="selectToken(token)"
        >
          <div class="token-info">
            <!-- Compact View -->
            <div class="token-header" @click="toggleToken(token)">
              <div class="token-summary">
                <span class="token-field">{{ token.collection }}</span> /
                <span class="token-field">{{ token.category }}</span> /
                <span class="token-field">{{ token.type }}</span> /
                <span class="token-field">{{ token.additionalKey }}</span> #
                <span class="token-field">{{ token.instanceId }}</span>
              </div>
              <div 
                class="lock-status"
                :class="{ 'status-locked': token.isLocked, 'status-unlocked': !token.isLocked }"
              >
                {{ token.isLocked ? '🔒' : '🔓' }}
              </div>
            </div>

            <!-- Expanded View -->
            <div v-if="expandedTokens.has(token.id)" class="token-details">
              <div v-if="token.holds && token.holds.length > 0">
                <h3 class="holds-title">Lock History</h3>
                <div v-for="(hold, index) in token.holds" :key="index" class="hold-details">
                  <div class="details-grid">
                    <div class="detail-row">
                      <span class="detail-label">Status:</span>
                      <span class="detail-value" :class="{ 
                        'status-active': !hold.expires || hold.expires > Date.now(),
                        'status-expired': hold.expires && hold.expires <= Date.now()
                      }">
                        {{ !hold.expires ? 'Active (No Expiry)' : 
                           hold.expires > Date.now() ? 'Active' : 'Expired' }}
                      </span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Authority:</span>
                      <span class="detail-value lock-authority">{{ hold.lockAuthority }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Created:</span>
                      <span class="detail-value">{{ formatDate(hold.created) }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Created By:</span>
                      <span class="detail-value">{{ hold.createdBy }}</span>
                    </div>
                    <div v-if="hold.expires" class="detail-row">
                      <span class="detail-label">Expires:</span>
                      <span class="detail-value">{{ formatDate(hold.expires) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="action-button-container">
                <button 
                  v-if="!token.isLocked"
                  @click.stop="lockToken(token)"
                  :disabled="isProcessing"
                  class="action-button lock-button"
                >
                  {{ isProcessing && selectedToken?.id === token.id ? 'Processing...' : 'Lock Token' }}
                </button>
                <button 
                  v-else-if="token.holds?.some(hold => isHoldActive(hold))"
                  @click.stop="unlockToken(token)"
                  :disabled="isProcessing"
                  class="action-button unlock-button"
                >
                  {{ isProcessing && selectedToken?.id === token.id ? 'Processing...' : 'Unlock Token' }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="tokens.length === 0" class="no-tokens">
          No NFTs found for this address
        </div>
      </div>
    </div>

    <!-- Status Messages -->
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { MetamaskConnectClient } from '@gala-chain/connect'

interface Token {
  id: string
  name: string
  collection: string
  category: string
  type: string
  additionalKey: string
  instanceId: string
  balance: string
  isLocked: boolean
  holds?: Array<{
    lockAuthority: string
    created: number
    createdBy: string
    expires?: number
  }>
}

const metamaskClient = new MetamaskConnectClient()
const isConnected = ref(false)
const walletAddress = ref('')
const tokens = ref<Token[]>([])
const selectedToken = ref<Token | null>(null)
const isProcessing = ref(false)
const error = ref('')
const success = ref('')
const targetAddress = ref('')
const addressError = ref('')
const isLoading = ref(false)
const expandedTokens = ref(new Set<string>())
const showInstructions = ref(false)

const truncatedAddress = computed(() => {
  if (!walletAddress.value) return ''
  const parts = walletAddress.value.split('|')
  if (parts.length !== 2) return walletAddress.value
  return `${parts[0]}|${parts[1].slice(0, 6)}...${parts[1].slice(-4)}`
})

// Validate address format when it changes
watch(targetAddress, (newValue) => {
  if (!newValue) {
    addressError.value = ''
    return
  }
  
  if (!newValue.startsWith('client|')) {
    addressError.value = 'Address must start with "client|"'
    return
  }
  
  const parts = newValue.split('|')
  if (parts.length !== 2 || !parts[1]) {
    addressError.value = 'Invalid address format'
    return
  }
  
  addressError.value = ''
})

//TODO: Tidy up the hex to base64 conversion
function hexToBase64(hexString: string) {
  // Remove 0x prefix if present
  const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString
  
  // Extract X and Y coordinates
  const x = cleanHex.slice(2, 66)
  const y = cleanHex.slice(66)

  // Determine prefix (0x02 for even Y, 0x03 for odd Y)
  const prefix = parseInt(y.slice(-1), 16) % 2 === 0 ? '02' : '03'

  // Create compressed key
  const compressedKey = prefix + x

  // Convert to Base64
  const base64Key = btoa(
    String.fromCharCode.apply(
      null,
      compressedKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    )
  )

  return base64Key
}

//TODO: Tidy up the public key comparison
function comparePublicKeys(metamaskKey: string, lookupKey: string) {
  try {
    // Convert metamask key to base64 format
    const metamaskBase64 = hexToBase64(metamaskKey)
    console.log('MetaMask key (hex):', metamaskKey)
    console.log('MetaMask key (cleaned):', metamaskKey.startsWith('0x') ? metamaskKey.slice(2) : metamaskKey)
    console.log('X coordinate:', metamaskKey.startsWith('0x') ? metamaskKey.slice(4, 68) : metamaskKey.slice(2, 66))
    console.log('Y coordinate:', metamaskKey.startsWith('0x') ? metamaskKey.slice(68) : metamaskKey.slice(66))
    console.log('Converted MetaMask key:', metamaskBase64)
    console.log('Target address key:', lookupKey)
    return metamaskBase64 === lookupKey
  } catch (err) {
    console.error('Error comparing public keys:', err)
    return false
  }
}

//TODO: Make validation prevent actions with mismatched keys
async function connectWallet() {
  try {
    await metamaskClient.connect()
    let address = metamaskClient.getWalletAddress
    if (address.startsWith('0x')) {
      address = "eth|" + address.slice(2)
    }
    walletAddress.value = address
    isConnected.value = true

    // Check that both the wallet and the target address have the same public key
    await verifyPublicKeyMatch()

    // Fetch tokens after verifying keys match
    await fetchTokens()
  } catch (err) {
    console.error('Error connecting wallet:', err)
    error.value = err instanceof Error ? err.message : 'Failed to connect wallet'
    isConnected.value = false
  }
}

async function verifyPublicKeyMatch() {
  const publicKey = await metamaskClient.getPublicKey()

  // Get the public key from the burn gateway using the target address
  const response = await fetch(`${import.meta.env.VITE_BURN_GATEWAY_PUBLIC_KEY_API}/GetPublicKey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: targetAddress.value
    })
  })
  const data = await response.json()

  if (!data.Data?.publicKey) {
    throw new Error('Could not retrieve public key from gateway')
  }

  const keysMatch = await comparePublicKeys(publicKey.publicKey, data.Data.publicKey)
  if (!keysMatch) {
    throw new Error('Connected wallet does not match the target address')
  }
}

async function fetchTokens() {
  if (!targetAddress.value || addressError.value) return
  
  isLoading.value = true
  error.value = ''
  
  try {
    const response = await fetch(`${import.meta.env.VITE_BURN_GATEWAY_API}/FetchBalances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: targetAddress.value
      })
    })

    const data = await response.json()
    if (!data.Data?.length) {
      tokens.value = []
      return
    }

    // Process NFTs only
    const nftBalances = data.Data.filter((item: any) => item.instanceIds.length > 0)

    // Create separate token entries for each instance
    const processedTokens: Token[] = nftBalances.flatMap((nft: any) => {
      const instances = nft.instanceIds
      // Create a token entry for each instance
      return Array.from(instances).map(instanceId => {
        // Find the lock hold for this instance if it exists
        const lockHold = nft.lockedHolds?.find((hold: any) => hold.instanceId === instanceId)
        const isLocked = !!lockHold
        
        return {
          id: `${nft.collection}-${nft.category}-${nft.type}-${nft.additionalKey}-${instanceId}`,
          name: `${nft.collection} #${instanceId}`,
          collection: nft.collection,
          category: nft.category,
          type: nft.type,
          additionalKey: nft.additionalKey,
          instanceId: instanceId,
          balance: "1",
          isLocked: nft.lockedHolds
            ?.filter((hold: any) => hold.instanceId === instanceId)
            ?.some((hold: any) => isHoldActive(hold)) ?? false,
          holds: nft.lockedHolds
            ?.filter((hold: any) => hold.instanceId === instanceId)
            ?.map((hold: any) => ({
              lockAuthority: hold.lockAuthority,
              created: hold.created,
              createdBy: hold.createdBy,
              expires: hold.expires
            }))
        }
      })
    })
    console.log(processedTokens)
    tokens.value = processedTokens
  } catch (err) {
    console.error('Error fetching tokens:', err)
    error.value = 'Failed to fetch tokens'
  } finally {
    isLoading.value = false
  }
}

function selectToken(token: Token) {
  selectedToken.value = token
}

async function lockToken(token: Token) {
  if (isProcessing.value) return
  
  selectedToken.value = token
  isProcessing.value = true
  error.value = ''
  success.value = ''

  try {
    const tokenInstanceKey = {
      additionalKey: token.additionalKey,
      category: token.category,
      collection: token.collection,
      type: token.type,
      instance: token.instanceId
    }

    const lockTokensDto = {
      tokenInstances: [{
        owner: targetAddress.value,
        quantity: "1",
        tokenInstanceKey
      }],
      uniqueKey: `manual-lock-${targetAddress.value}-${Date.now()}`
    }

    const signedLockDto = await metamaskClient.sign("LockTokens", lockTokensDto)

    const response = await fetch(`${import.meta.env.VITE_BURN_GATEWAY_API}/LockTokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedLockDto)
    })

    if (!response.ok) {
      throw new Error(`Failed to lock token: ${response.statusText}`)
    }

    const index = tokens.value.findIndex(t => t.id === token.id)
    if (index !== -1) {
      tokens.value[index].isLocked = true
    }
    
    success.value = `Successfully locked ${token.name}`
  } catch (err) {
    console.error('Error locking token:', err)
    error.value = 'Failed to lock token'
  } finally {
    isProcessing.value = false
  }
}

async function unlockToken(token: Token) {
  if (isProcessing.value) return
  
  selectedToken.value = token
  isProcessing.value = true
  error.value = ''
  success.value = ''

  try {
    const tokenInstanceKey = {
      additionalKey: token.additionalKey,
      category: token.category,
      collection: token.collection,
      type: token.type,
      instance: token.instanceId
    }

    const unlockTokensDto = {
        tokenInstances: [{
          owner: targetAddress.value,
          quantity: "1",
          tokenInstanceKey
        }],
        uniqueKey: `manual-unlock-${targetAddress.value}-${Date.now()}`
    }

    const signedUnlockDto = await metamaskClient.sign("UnlockTokens", unlockTokensDto)

    const response = await fetch(`${import.meta.env.VITE_BURN_GATEWAY_API}/UnlockTokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedUnlockDto)
    })

    if (!response.ok) {
      throw new Error(`Failed to unlock token: ${response.statusText}`)
    }

    const index = tokens.value.findIndex(t => t.id === token.id)
    if (index !== -1) {
      tokens.value[index].isLocked = false
    }
    
    success.value = `Successfully unlocked ${token.name}`
  } catch (err) {
    console.error('Error unlocking token:', err)
    error.value = 'Failed to unlock token'
  } finally {
    isProcessing.value = false
  }
}

const sortedTokens = computed(() => {
  return [...tokens.value].sort((a, b) => {
    // Sort by locked status first (locked items at top)
    if (a.isLocked !== b.isLocked) {
      return b.isLocked ? 1 : -1
    }
    // Then sort by collection and instance ID
    return `${a.collection}${a.instanceId}`.localeCompare(`${b.collection}${b.instanceId}`)
  })
})

function toggleToken(token: Token) {
  if (expandedTokens.value.has(token.id)) {
    expandedTokens.value.delete(token.id)
  } else {
    expandedTokens.value.add(token.id)
  }
}

function formatDate(timestamp?: number) {
  if (!timestamp) return null
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Helper function to check if a hold is active
function isHoldActive(hold: { expires?: number }) {
  return !hold.expires || hold.expires > Date.now()
}
</script>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.wallet-section {
  margin-bottom: 20px;
}

.wallet-address {
  font-size: 0.9em;
  color: #666;
}

.token-section {
  margin-top: 20px;
}

.token-list {
  display: grid;
  gap: 10px;
}

.token-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.token-item:hover {
  background-color: #f5f5f5;
}

.token-locked {
  background-color: #f8f9fa;
}

.token-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.token-name {
  font-weight: bold;
}

.token-balance {
  font-size: 0.9em;
  color: #666;
}

.token-status {
  font-size: 0.9em;
}

.token-actions {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.button {
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error {
  color: #dc3545;
  margin-top: 10px;
}

.success {
  color: #28a745;
  margin-top: 10px;
}

.address-input {
  margin-bottom: 20px;
}

.input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1em;
}

.input-error {
  border-color: #dc3545;
}

.error-text {
  color: #dc3545;
  font-size: 0.9em;
  margin-top: 5px;
}

.token-details {
  font-size: 0.85em;
  color: #666;
  line-height: 1.4;
}

.no-tokens {
  text-align: center;
  padding: 20px;
  color: #666;
  font-style: italic;
  background: #f8f9fa;
  border-radius: 8px;
}

.input-row {
  display: flex;
  gap: 10px;
}

.input {
  flex: 1;
}

.button {
  white-space: nowrap;
}

.token-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  cursor: pointer;
}

.token-header:hover {
  background-color: #f5f5f5;
}

.details-grid {
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  margin: 8px 0;
}

.detail-row {
  display: flex;
  margin-bottom: 6px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-weight: 500;
  width: 100px;
  color: #666;
}

.detail-value {
  flex: 1;
}

.lock-status {
  font-size: 0.9em;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.status-locked {
  background-color: #dc3545;
  color: white;
}

.status-unlocked {
  background-color: #28a745;
  color: white;
}

.action-button {
  margin-top: 10px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 0.9em;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;
}

.lock-button {
  background-color: #dc3545;
  color: white;
}

.lock-button:hover:not(:disabled) {
  background-color: #c82333;
}

.unlock-button {
  background-color: #28a745;
  color: white;
}

.unlock-button:hover:not(:disabled) {
  background-color: #218838;
}

.selected {
  border: 2px solid #007bff;
}

.token-item {
  cursor: default;
}

.lock-authority {
  color: #dc3545;
  font-weight: 500;
}

.token-summary {
  font-family: monospace;
  font-size: 0.95em;
  color: #000;
  font-weight: 600;
}

.token-field {
  display: inline-block;
  color: #333;
}

.action-button-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.action-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 0.9em;
  cursor: pointer;
  transition: background-color 0.2s;
  width: auto;
  min-width: 120px;
}

.input-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.info-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1em;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #666;
}

.info-button:hover {
  color: #333;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.modal-content h2 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #333;
}

.modal-content ol {
  margin: 0 0 20px 0;
  padding-left: 24px;
}

.modal-content li {
  margin-bottom: 12px;
  line-height: 1.4;
  color: #444;
}

.modal-content .button {
  margin-top: 8px;
}

.holds-title {
  font-size: 1.1em;
  color: #333;
  margin: 16px 0 12px 0;
}

.hold-details {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 6px;
}

.hold-details:last-child {
  margin-bottom: 0;
}

.status-active {
  color: #28a745;
  font-weight: 500;
}

.status-expired {
  color: #6c757d;
  font-weight: 500;
}
</style> 