# TransferPrivate200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Chain** | Pointer to **string** |  | [optional] 
**Curve** | Pointer to **string** |  | [optional] 
**StealthAddress** | Pointer to **string** | Chain-native stealth address | [optional] 
**EphemeralPublicKey** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 
**ViewTag** | Pointer to **int32** |  | [optional] 
**Commitment** | Pointer to **string** |  | [optional] 
**BlindingFactor** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 
**ViewingKeyHash** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 
**SharedSecret** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 
**ChainData** | Pointer to [**TransferPrivate200ResponseDataChainData**](TransferPrivate200ResponseDataChainData.md) |  | [optional] 

## Methods

### NewTransferPrivate200ResponseData

`func NewTransferPrivate200ResponseData() *TransferPrivate200ResponseData`

NewTransferPrivate200ResponseData instantiates a new TransferPrivate200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewTransferPrivate200ResponseDataWithDefaults

`func NewTransferPrivate200ResponseDataWithDefaults() *TransferPrivate200ResponseData`

NewTransferPrivate200ResponseDataWithDefaults instantiates a new TransferPrivate200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetChain

`func (o *TransferPrivate200ResponseData) GetChain() string`

GetChain returns the Chain field if non-nil, zero value otherwise.

### GetChainOk

`func (o *TransferPrivate200ResponseData) GetChainOk() (*string, bool)`

GetChainOk returns a tuple with the Chain field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChain

`func (o *TransferPrivate200ResponseData) SetChain(v string)`

SetChain sets Chain field to given value.

### HasChain

`func (o *TransferPrivate200ResponseData) HasChain() bool`

HasChain returns a boolean if a field has been set.

### GetCurve

`func (o *TransferPrivate200ResponseData) GetCurve() string`

GetCurve returns the Curve field if non-nil, zero value otherwise.

### GetCurveOk

`func (o *TransferPrivate200ResponseData) GetCurveOk() (*string, bool)`

GetCurveOk returns a tuple with the Curve field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCurve

`func (o *TransferPrivate200ResponseData) SetCurve(v string)`

SetCurve sets Curve field to given value.

### HasCurve

`func (o *TransferPrivate200ResponseData) HasCurve() bool`

HasCurve returns a boolean if a field has been set.

### GetStealthAddress

`func (o *TransferPrivate200ResponseData) GetStealthAddress() string`

GetStealthAddress returns the StealthAddress field if non-nil, zero value otherwise.

### GetStealthAddressOk

`func (o *TransferPrivate200ResponseData) GetStealthAddressOk() (*string, bool)`

GetStealthAddressOk returns a tuple with the StealthAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStealthAddress

`func (o *TransferPrivate200ResponseData) SetStealthAddress(v string)`

SetStealthAddress sets StealthAddress field to given value.

### HasStealthAddress

`func (o *TransferPrivate200ResponseData) HasStealthAddress() bool`

HasStealthAddress returns a boolean if a field has been set.

### GetEphemeralPublicKey

`func (o *TransferPrivate200ResponseData) GetEphemeralPublicKey() string`

GetEphemeralPublicKey returns the EphemeralPublicKey field if non-nil, zero value otherwise.

### GetEphemeralPublicKeyOk

`func (o *TransferPrivate200ResponseData) GetEphemeralPublicKeyOk() (*string, bool)`

GetEphemeralPublicKeyOk returns a tuple with the EphemeralPublicKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEphemeralPublicKey

`func (o *TransferPrivate200ResponseData) SetEphemeralPublicKey(v string)`

SetEphemeralPublicKey sets EphemeralPublicKey field to given value.

### HasEphemeralPublicKey

`func (o *TransferPrivate200ResponseData) HasEphemeralPublicKey() bool`

HasEphemeralPublicKey returns a boolean if a field has been set.

### GetViewTag

`func (o *TransferPrivate200ResponseData) GetViewTag() int32`

GetViewTag returns the ViewTag field if non-nil, zero value otherwise.

### GetViewTagOk

`func (o *TransferPrivate200ResponseData) GetViewTagOk() (*int32, bool)`

GetViewTagOk returns a tuple with the ViewTag field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewTag

`func (o *TransferPrivate200ResponseData) SetViewTag(v int32)`

SetViewTag sets ViewTag field to given value.

### HasViewTag

`func (o *TransferPrivate200ResponseData) HasViewTag() bool`

HasViewTag returns a boolean if a field has been set.

### GetCommitment

`func (o *TransferPrivate200ResponseData) GetCommitment() string`

GetCommitment returns the Commitment field if non-nil, zero value otherwise.

### GetCommitmentOk

`func (o *TransferPrivate200ResponseData) GetCommitmentOk() (*string, bool)`

GetCommitmentOk returns a tuple with the Commitment field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCommitment

`func (o *TransferPrivate200ResponseData) SetCommitment(v string)`

SetCommitment sets Commitment field to given value.

### HasCommitment

`func (o *TransferPrivate200ResponseData) HasCommitment() bool`

HasCommitment returns a boolean if a field has been set.

### GetBlindingFactor

`func (o *TransferPrivate200ResponseData) GetBlindingFactor() string`

GetBlindingFactor returns the BlindingFactor field if non-nil, zero value otherwise.

### GetBlindingFactorOk

`func (o *TransferPrivate200ResponseData) GetBlindingFactorOk() (*string, bool)`

GetBlindingFactorOk returns a tuple with the BlindingFactor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBlindingFactor

`func (o *TransferPrivate200ResponseData) SetBlindingFactor(v string)`

SetBlindingFactor sets BlindingFactor field to given value.

### HasBlindingFactor

`func (o *TransferPrivate200ResponseData) HasBlindingFactor() bool`

HasBlindingFactor returns a boolean if a field has been set.

### GetViewingKeyHash

`func (o *TransferPrivate200ResponseData) GetViewingKeyHash() string`

GetViewingKeyHash returns the ViewingKeyHash field if non-nil, zero value otherwise.

### GetViewingKeyHashOk

`func (o *TransferPrivate200ResponseData) GetViewingKeyHashOk() (*string, bool)`

GetViewingKeyHashOk returns a tuple with the ViewingKeyHash field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKeyHash

`func (o *TransferPrivate200ResponseData) SetViewingKeyHash(v string)`

SetViewingKeyHash sets ViewingKeyHash field to given value.

### HasViewingKeyHash

`func (o *TransferPrivate200ResponseData) HasViewingKeyHash() bool`

HasViewingKeyHash returns a boolean if a field has been set.

### GetSharedSecret

`func (o *TransferPrivate200ResponseData) GetSharedSecret() string`

GetSharedSecret returns the SharedSecret field if non-nil, zero value otherwise.

### GetSharedSecretOk

`func (o *TransferPrivate200ResponseData) GetSharedSecretOk() (*string, bool)`

GetSharedSecretOk returns a tuple with the SharedSecret field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSharedSecret

`func (o *TransferPrivate200ResponseData) SetSharedSecret(v string)`

SetSharedSecret sets SharedSecret field to given value.

### HasSharedSecret

`func (o *TransferPrivate200ResponseData) HasSharedSecret() bool`

HasSharedSecret returns a boolean if a field has been set.

### GetChainData

`func (o *TransferPrivate200ResponseData) GetChainData() TransferPrivate200ResponseDataChainData`

GetChainData returns the ChainData field if non-nil, zero value otherwise.

### GetChainDataOk

`func (o *TransferPrivate200ResponseData) GetChainDataOk() (*TransferPrivate200ResponseDataChainData, bool)`

GetChainDataOk returns a tuple with the ChainData field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChainData

`func (o *TransferPrivate200ResponseData) SetChainData(v TransferPrivate200ResponseDataChainData)`

SetChainData sets ChainData field to given value.

### HasChainData

`func (o *TransferPrivate200ResponseData) HasChainData() bool`

HasChainData returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


