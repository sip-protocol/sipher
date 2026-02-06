# PrivateSwap200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**OutputStealthAddress** | Pointer to **string** | Base58-encoded Solana public key | [optional] 
**EphemeralPublicKey** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 
**ViewTag** | Pointer to **int32** |  | [optional] 
**Commitment** | Pointer to **string** | Pedersen commitment for output amount | [optional] 
**BlindingFactor** | Pointer to **string** | Blinding factor for commitment | [optional] 
**ViewingKeyHash** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 
**SharedSecret** | Pointer to **string** |  | [optional] 
**InputMint** | Pointer to **string** |  | [optional] 
**InputAmount** | Pointer to **string** |  | [optional] 
**OutputMint** | Pointer to **string** |  | [optional] 
**OutputAmount** | Pointer to **string** |  | [optional] 
**OutputAmountMin** | Pointer to **string** |  | [optional] 
**QuoteId** | Pointer to **string** |  | [optional] 
**PriceImpactPct** | Pointer to **string** |  | [optional] 
**SlippageBps** | Pointer to **int32** |  | [optional] 
**Transactions** | Pointer to [**[]PrivateSwap200ResponseDataTransactionsInner**](PrivateSwap200ResponseDataTransactionsInner.md) |  | [optional] 
**ExecutionOrder** | Pointer to **[]string** |  | [optional] 
**EstimatedComputeUnits** | Pointer to **int32** |  | [optional] 
**CsplWrapped** | Pointer to **bool** |  | [optional] 

## Methods

### NewPrivateSwap200ResponseData

`func NewPrivateSwap200ResponseData() *PrivateSwap200ResponseData`

NewPrivateSwap200ResponseData instantiates a new PrivateSwap200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewPrivateSwap200ResponseDataWithDefaults

`func NewPrivateSwap200ResponseDataWithDefaults() *PrivateSwap200ResponseData`

NewPrivateSwap200ResponseDataWithDefaults instantiates a new PrivateSwap200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetOutputStealthAddress

`func (o *PrivateSwap200ResponseData) GetOutputStealthAddress() string`

GetOutputStealthAddress returns the OutputStealthAddress field if non-nil, zero value otherwise.

### GetOutputStealthAddressOk

`func (o *PrivateSwap200ResponseData) GetOutputStealthAddressOk() (*string, bool)`

GetOutputStealthAddressOk returns a tuple with the OutputStealthAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOutputStealthAddress

`func (o *PrivateSwap200ResponseData) SetOutputStealthAddress(v string)`

SetOutputStealthAddress sets OutputStealthAddress field to given value.

### HasOutputStealthAddress

`func (o *PrivateSwap200ResponseData) HasOutputStealthAddress() bool`

HasOutputStealthAddress returns a boolean if a field has been set.

### GetEphemeralPublicKey

`func (o *PrivateSwap200ResponseData) GetEphemeralPublicKey() string`

GetEphemeralPublicKey returns the EphemeralPublicKey field if non-nil, zero value otherwise.

### GetEphemeralPublicKeyOk

`func (o *PrivateSwap200ResponseData) GetEphemeralPublicKeyOk() (*string, bool)`

GetEphemeralPublicKeyOk returns a tuple with the EphemeralPublicKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEphemeralPublicKey

`func (o *PrivateSwap200ResponseData) SetEphemeralPublicKey(v string)`

SetEphemeralPublicKey sets EphemeralPublicKey field to given value.

### HasEphemeralPublicKey

`func (o *PrivateSwap200ResponseData) HasEphemeralPublicKey() bool`

HasEphemeralPublicKey returns a boolean if a field has been set.

### GetViewTag

`func (o *PrivateSwap200ResponseData) GetViewTag() int32`

GetViewTag returns the ViewTag field if non-nil, zero value otherwise.

### GetViewTagOk

`func (o *PrivateSwap200ResponseData) GetViewTagOk() (*int32, bool)`

GetViewTagOk returns a tuple with the ViewTag field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewTag

`func (o *PrivateSwap200ResponseData) SetViewTag(v int32)`

SetViewTag sets ViewTag field to given value.

### HasViewTag

`func (o *PrivateSwap200ResponseData) HasViewTag() bool`

HasViewTag returns a boolean if a field has been set.

### GetCommitment

`func (o *PrivateSwap200ResponseData) GetCommitment() string`

GetCommitment returns the Commitment field if non-nil, zero value otherwise.

### GetCommitmentOk

`func (o *PrivateSwap200ResponseData) GetCommitmentOk() (*string, bool)`

GetCommitmentOk returns a tuple with the Commitment field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCommitment

`func (o *PrivateSwap200ResponseData) SetCommitment(v string)`

SetCommitment sets Commitment field to given value.

### HasCommitment

`func (o *PrivateSwap200ResponseData) HasCommitment() bool`

HasCommitment returns a boolean if a field has been set.

### GetBlindingFactor

`func (o *PrivateSwap200ResponseData) GetBlindingFactor() string`

GetBlindingFactor returns the BlindingFactor field if non-nil, zero value otherwise.

### GetBlindingFactorOk

`func (o *PrivateSwap200ResponseData) GetBlindingFactorOk() (*string, bool)`

GetBlindingFactorOk returns a tuple with the BlindingFactor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBlindingFactor

`func (o *PrivateSwap200ResponseData) SetBlindingFactor(v string)`

SetBlindingFactor sets BlindingFactor field to given value.

### HasBlindingFactor

`func (o *PrivateSwap200ResponseData) HasBlindingFactor() bool`

HasBlindingFactor returns a boolean if a field has been set.

### GetViewingKeyHash

`func (o *PrivateSwap200ResponseData) GetViewingKeyHash() string`

GetViewingKeyHash returns the ViewingKeyHash field if non-nil, zero value otherwise.

### GetViewingKeyHashOk

`func (o *PrivateSwap200ResponseData) GetViewingKeyHashOk() (*string, bool)`

GetViewingKeyHashOk returns a tuple with the ViewingKeyHash field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKeyHash

`func (o *PrivateSwap200ResponseData) SetViewingKeyHash(v string)`

SetViewingKeyHash sets ViewingKeyHash field to given value.

### HasViewingKeyHash

`func (o *PrivateSwap200ResponseData) HasViewingKeyHash() bool`

HasViewingKeyHash returns a boolean if a field has been set.

### GetSharedSecret

`func (o *PrivateSwap200ResponseData) GetSharedSecret() string`

GetSharedSecret returns the SharedSecret field if non-nil, zero value otherwise.

### GetSharedSecretOk

`func (o *PrivateSwap200ResponseData) GetSharedSecretOk() (*string, bool)`

GetSharedSecretOk returns a tuple with the SharedSecret field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSharedSecret

`func (o *PrivateSwap200ResponseData) SetSharedSecret(v string)`

SetSharedSecret sets SharedSecret field to given value.

### HasSharedSecret

`func (o *PrivateSwap200ResponseData) HasSharedSecret() bool`

HasSharedSecret returns a boolean if a field has been set.

### GetInputMint

`func (o *PrivateSwap200ResponseData) GetInputMint() string`

GetInputMint returns the InputMint field if non-nil, zero value otherwise.

### GetInputMintOk

`func (o *PrivateSwap200ResponseData) GetInputMintOk() (*string, bool)`

GetInputMintOk returns a tuple with the InputMint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInputMint

`func (o *PrivateSwap200ResponseData) SetInputMint(v string)`

SetInputMint sets InputMint field to given value.

### HasInputMint

`func (o *PrivateSwap200ResponseData) HasInputMint() bool`

HasInputMint returns a boolean if a field has been set.

### GetInputAmount

`func (o *PrivateSwap200ResponseData) GetInputAmount() string`

GetInputAmount returns the InputAmount field if non-nil, zero value otherwise.

### GetInputAmountOk

`func (o *PrivateSwap200ResponseData) GetInputAmountOk() (*string, bool)`

GetInputAmountOk returns a tuple with the InputAmount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInputAmount

`func (o *PrivateSwap200ResponseData) SetInputAmount(v string)`

SetInputAmount sets InputAmount field to given value.

### HasInputAmount

`func (o *PrivateSwap200ResponseData) HasInputAmount() bool`

HasInputAmount returns a boolean if a field has been set.

### GetOutputMint

`func (o *PrivateSwap200ResponseData) GetOutputMint() string`

GetOutputMint returns the OutputMint field if non-nil, zero value otherwise.

### GetOutputMintOk

`func (o *PrivateSwap200ResponseData) GetOutputMintOk() (*string, bool)`

GetOutputMintOk returns a tuple with the OutputMint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOutputMint

`func (o *PrivateSwap200ResponseData) SetOutputMint(v string)`

SetOutputMint sets OutputMint field to given value.

### HasOutputMint

`func (o *PrivateSwap200ResponseData) HasOutputMint() bool`

HasOutputMint returns a boolean if a field has been set.

### GetOutputAmount

`func (o *PrivateSwap200ResponseData) GetOutputAmount() string`

GetOutputAmount returns the OutputAmount field if non-nil, zero value otherwise.

### GetOutputAmountOk

`func (o *PrivateSwap200ResponseData) GetOutputAmountOk() (*string, bool)`

GetOutputAmountOk returns a tuple with the OutputAmount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOutputAmount

`func (o *PrivateSwap200ResponseData) SetOutputAmount(v string)`

SetOutputAmount sets OutputAmount field to given value.

### HasOutputAmount

`func (o *PrivateSwap200ResponseData) HasOutputAmount() bool`

HasOutputAmount returns a boolean if a field has been set.

### GetOutputAmountMin

`func (o *PrivateSwap200ResponseData) GetOutputAmountMin() string`

GetOutputAmountMin returns the OutputAmountMin field if non-nil, zero value otherwise.

### GetOutputAmountMinOk

`func (o *PrivateSwap200ResponseData) GetOutputAmountMinOk() (*string, bool)`

GetOutputAmountMinOk returns a tuple with the OutputAmountMin field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOutputAmountMin

`func (o *PrivateSwap200ResponseData) SetOutputAmountMin(v string)`

SetOutputAmountMin sets OutputAmountMin field to given value.

### HasOutputAmountMin

`func (o *PrivateSwap200ResponseData) HasOutputAmountMin() bool`

HasOutputAmountMin returns a boolean if a field has been set.

### GetQuoteId

`func (o *PrivateSwap200ResponseData) GetQuoteId() string`

GetQuoteId returns the QuoteId field if non-nil, zero value otherwise.

### GetQuoteIdOk

`func (o *PrivateSwap200ResponseData) GetQuoteIdOk() (*string, bool)`

GetQuoteIdOk returns a tuple with the QuoteId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetQuoteId

`func (o *PrivateSwap200ResponseData) SetQuoteId(v string)`

SetQuoteId sets QuoteId field to given value.

### HasQuoteId

`func (o *PrivateSwap200ResponseData) HasQuoteId() bool`

HasQuoteId returns a boolean if a field has been set.

### GetPriceImpactPct

`func (o *PrivateSwap200ResponseData) GetPriceImpactPct() string`

GetPriceImpactPct returns the PriceImpactPct field if non-nil, zero value otherwise.

### GetPriceImpactPctOk

`func (o *PrivateSwap200ResponseData) GetPriceImpactPctOk() (*string, bool)`

GetPriceImpactPctOk returns a tuple with the PriceImpactPct field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPriceImpactPct

`func (o *PrivateSwap200ResponseData) SetPriceImpactPct(v string)`

SetPriceImpactPct sets PriceImpactPct field to given value.

### HasPriceImpactPct

`func (o *PrivateSwap200ResponseData) HasPriceImpactPct() bool`

HasPriceImpactPct returns a boolean if a field has been set.

### GetSlippageBps

`func (o *PrivateSwap200ResponseData) GetSlippageBps() int32`

GetSlippageBps returns the SlippageBps field if non-nil, zero value otherwise.

### GetSlippageBpsOk

`func (o *PrivateSwap200ResponseData) GetSlippageBpsOk() (*int32, bool)`

GetSlippageBpsOk returns a tuple with the SlippageBps field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSlippageBps

`func (o *PrivateSwap200ResponseData) SetSlippageBps(v int32)`

SetSlippageBps sets SlippageBps field to given value.

### HasSlippageBps

`func (o *PrivateSwap200ResponseData) HasSlippageBps() bool`

HasSlippageBps returns a boolean if a field has been set.

### GetTransactions

`func (o *PrivateSwap200ResponseData) GetTransactions() []PrivateSwap200ResponseDataTransactionsInner`

GetTransactions returns the Transactions field if non-nil, zero value otherwise.

### GetTransactionsOk

`func (o *PrivateSwap200ResponseData) GetTransactionsOk() (*[]PrivateSwap200ResponseDataTransactionsInner, bool)`

GetTransactionsOk returns a tuple with the Transactions field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTransactions

`func (o *PrivateSwap200ResponseData) SetTransactions(v []PrivateSwap200ResponseDataTransactionsInner)`

SetTransactions sets Transactions field to given value.

### HasTransactions

`func (o *PrivateSwap200ResponseData) HasTransactions() bool`

HasTransactions returns a boolean if a field has been set.

### GetExecutionOrder

`func (o *PrivateSwap200ResponseData) GetExecutionOrder() []string`

GetExecutionOrder returns the ExecutionOrder field if non-nil, zero value otherwise.

### GetExecutionOrderOk

`func (o *PrivateSwap200ResponseData) GetExecutionOrderOk() (*[]string, bool)`

GetExecutionOrderOk returns a tuple with the ExecutionOrder field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExecutionOrder

`func (o *PrivateSwap200ResponseData) SetExecutionOrder(v []string)`

SetExecutionOrder sets ExecutionOrder field to given value.

### HasExecutionOrder

`func (o *PrivateSwap200ResponseData) HasExecutionOrder() bool`

HasExecutionOrder returns a boolean if a field has been set.

### GetEstimatedComputeUnits

`func (o *PrivateSwap200ResponseData) GetEstimatedComputeUnits() int32`

GetEstimatedComputeUnits returns the EstimatedComputeUnits field if non-nil, zero value otherwise.

### GetEstimatedComputeUnitsOk

`func (o *PrivateSwap200ResponseData) GetEstimatedComputeUnitsOk() (*int32, bool)`

GetEstimatedComputeUnitsOk returns a tuple with the EstimatedComputeUnits field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEstimatedComputeUnits

`func (o *PrivateSwap200ResponseData) SetEstimatedComputeUnits(v int32)`

SetEstimatedComputeUnits sets EstimatedComputeUnits field to given value.

### HasEstimatedComputeUnits

`func (o *PrivateSwap200ResponseData) HasEstimatedComputeUnits() bool`

HasEstimatedComputeUnits returns a boolean if a field has been set.

### GetCsplWrapped

`func (o *PrivateSwap200ResponseData) GetCsplWrapped() bool`

GetCsplWrapped returns the CsplWrapped field if non-nil, zero value otherwise.

### GetCsplWrappedOk

`func (o *PrivateSwap200ResponseData) GetCsplWrappedOk() (*bool, bool)`

GetCsplWrappedOk returns a tuple with the CsplWrapped field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCsplWrapped

`func (o *PrivateSwap200ResponseData) SetCsplWrapped(v bool)`

SetCsplWrapped sets CsplWrapped field to given value.

### HasCsplWrapped

`func (o *PrivateSwap200ResponseData) HasCsplWrapped() bool`

HasCsplWrapped returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


