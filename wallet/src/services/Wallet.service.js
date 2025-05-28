import { defaultEthConnectionConfig } from '../constants';

import {
	IdentityStorage,
	CredentialStorage,
	IndexedDBDataSource,
	BjjProvider,
	KmsKeyType,
	IdentityWallet,
	CredentialWallet,
	KMS,
	EthStateStorage,
	MerkleTreeIndexedDBStorage,
	IndexedDBPrivateKeyStore,
	CredentialStatusResolverRegistry,
	CredentialStatusPublisherRegistry,
	CredentialStatusType,
	RHSResolver,
	OnChainResolver,
	IssuerResolver,
	AgentResolver,
	Iden3OnchainSmtCredentialStatusPublisher,
	OnChainRevocationStorage,
} from '@0xpolygonid/js-sdk';

export class WalletService {
	static async createWallet(signer) {
		const keyStore = new IndexedDBPrivateKeyStore();
		const bjjProvider = new BjjProvider(KmsKeyType.BabyJubJub, keyStore);
		const kms = new KMS();
		kms.registerKeyProvider(KmsKeyType.BabyJubJub, bjjProvider);
		let dataStorage = {
			credential: new CredentialStorage(
				new IndexedDBDataSource(CredentialStorage.storageKey)
			),
			identity: new IdentityStorage(
				new IndexedDBDataSource(IdentityStorage.identitiesStorageKey),
				new IndexedDBDataSource(IdentityStorage.profilesStorageKey)
			),
			mt: new MerkleTreeIndexedDBStorage(40),
			states: new EthStateStorage(defaultEthConnectionConfig[0])

		};

		const resolvers = new CredentialStatusResolverRegistry();
		resolvers.register(
			CredentialStatusType.SparseMerkleTreeProof,
			new IssuerResolver()
		);
    	resolvers.register(
			CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
			new RHSResolver(dataStorage.states)
		);
		resolvers.register(
			CredentialStatusType.Iden3OnchainSparseMerkleTreeProof2023,
			new OnChainResolver(defaultEthConnectionConfig)
		);
		resolvers.register(
			CredentialStatusType.Iden3commRevocationStatusV1,
			new AgentResolver()
		);


		const credWallet = new CredentialWallet(dataStorage, resolvers);

		const onChainRevocationStorage = new OnChainRevocationStorage(
			defaultEthConnectionConfig[0],
			"0x7dF78ED37d0B39Ffb6d4D527Bb1865Bf85B60f81",
			signer
		);
		const publisherRegistry = new CredentialStatusPublisherRegistry();

		publisherRegistry.register(
			CredentialStatusType.Iden3OnchainSparseMerkleTreeProof2023,
			new Iden3OnchainSmtCredentialStatusPublisher(onChainRevocationStorage)
		);

		let wallet = new IdentityWallet(kms, dataStorage, credWallet, {credentialStatusPublisherRegistry:publisherRegistry});

		return {
			wallet: wallet,
			credWallet: credWallet,
			kms: kms,
			dataStorage: dataStorage
		}
	}
}
