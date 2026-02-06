# PrivateSwapRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Sender** | **string** | Base58-encoded Solana public key | 
**InputMint** | **string** | SPL token mint to swap from | 
**InputAmount** | **string** | Amount to swap (smallest units) | 
**OutputMint** | **string** | SPL token mint to swap to | 
**SlippageBps** | Pointer to **int32** | Slippage tolerance in basis points (default 50 &#x3D; 0.5%) | [optional] [default to 50]
**RecipientMetaAddress** | Pointer to [**PrivateSwapRequestRecipientMetaAddress**](PrivateSwapRequestRecipientMetaAddress.md) |  | [optional] 

## Methods

### NewPrivateSwapRequest

`func NewPrivateSwapRequest(sender string, inputMint string, inputAmount string, outputMint string, ) *PrivateSwapRequest`

NewPrivateSwapRequest instantiates a new PrivateSwapRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewPrivateSwapRequestWithDefaults

`func NewPrivateSwapRequestWithDefaults() *PrivateSwapRequest`

NewPrivateSwapRequestWithDefaults instantiates a new PrivateSwapRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSender

`func (o *PrivateSwapRequest) GetSender() string`

GetSender returns the Sender field if non-nil, zero value otherwise.

### GetSenderOk

`func (o *PrivateSwapRequest) GetSenderOk() (*string, bool)`

GetSenderOk returns a tuple with the Sender field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSender

`func (o *PrivateSwapRequest) SetSender(v string)`

SetSender sets Sender field to given value.


### GetInputMint

`func (o *PrivateSwapRequest) GetInputMint() string`

GetInputMint returns the InputMint field if non-nil, zero value otherwise.

### GetInputMintOk

`func (o *PrivateSwapRequest) GetInputMintOk() (*string, bool)`

GetInputMintOk returns a tuple with the InputMint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInputMint

`func (o *PrivateSwapRequest) SetInputMint(v string)`

SetInputMint sets InputMint field to given value.


### GetInputAmount

`func (o *PrivateSwapRequest) GetInputAmount() string`

GetInputAmount returns the InputAmount field if non-nil, zero value otherwise.

### GetInputAmountOk

`func (o *PrivateSwapRequest) GetInputAmountOk() (*string, bool)`

GetInputAmountOk returns a tuple with the InputAmount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInputAmount

`func (o *PrivateSwapRequest) SetInputAmount(v string)`

SetInputAmount sets InputAmount field to given value.


### GetOutputMint

`func (o *PrivateSwapRequest) GetOutputMint() string`

GetOutputMint returns the OutputMint field if non-nil, zero value otherwise.

### GetOutputMintOk

`func (o *PrivateSwapRequest) GetOutputMintOk() (*string, bool)`

GetOutputMintOk returns a tuple with the OutputMint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOutputMint

`func (o *PrivateSwapRequest) SetOutputMint(v string)`

SetOutputMint sets OutputMint field to given value.


### GetSlippageBps

`func (o *PrivateSwapRequest) GetSlippageBps() int32`

GetSlippageBps returns the SlippageBps field if non-nil, zero value otherwise.

### GetSlippageBpsOk

`func (o *PrivateSwapRequest) GetSlippageBpsOk() (*int32, bool)`

GetSlippageBpsOk returns a tuple with the SlippageBps field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSlippageBps

`func (o *PrivateSwapRequest) SetSlippageBps(v int32)`

SetSlippageBps sets SlippageBps field to given value.

### HasSlippageBps

`func (o *PrivateSwapRequest) HasSlippageBps() bool`

HasSlippageBps returns a boolean if a field has been set.

### GetRecipientMetaAddress

`func (o *PrivateSwapRequest) GetRecipientMetaAddress() PrivateSwapRequestRecipientMetaAddress`

GetRecipientMetaAddress returns the RecipientMetaAddress field if non-nil, zero value otherwise.

### GetRecipientMetaAddressOk

`func (o *PrivateSwapRequest) GetRecipientMetaAddressOk() (*PrivateSwapRequestRecipientMetaAddress, bool)`

GetRecipientMetaAddressOk returns a tuple with the RecipientMetaAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRecipientMetaAddress

`func (o *PrivateSwapRequest) SetRecipientMetaAddress(v PrivateSwapRequestRecipientMetaAddress)`

SetRecipientMetaAddress sets RecipientMetaAddress field to given value.

### HasRecipientMetaAddress

`func (o *PrivateSwapRequest) HasRecipientMetaAddress() bool`

HasRecipientMetaAddress returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


