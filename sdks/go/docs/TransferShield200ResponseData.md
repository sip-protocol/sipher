# TransferShield200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Transaction** | Pointer to **string** | Base64-encoded unsigned transaction | [optional] 
**StealthAddress** | Pointer to **string** |  | [optional] 
**EphemeralPublicKey** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 
**ViewTag** | Pointer to **int32** |  | [optional] 
**Commitment** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 
**BlindingFactor** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 
**ViewingKeyHash** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 
**SharedSecret** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 

## Methods

### NewTransferShield200ResponseData

`func NewTransferShield200ResponseData() *TransferShield200ResponseData`

NewTransferShield200ResponseData instantiates a new TransferShield200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewTransferShield200ResponseDataWithDefaults

`func NewTransferShield200ResponseDataWithDefaults() *TransferShield200ResponseData`

NewTransferShield200ResponseDataWithDefaults instantiates a new TransferShield200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetTransaction

`func (o *TransferShield200ResponseData) GetTransaction() string`

GetTransaction returns the Transaction field if non-nil, zero value otherwise.

### GetTransactionOk

`func (o *TransferShield200ResponseData) GetTransactionOk() (*string, bool)`

GetTransactionOk returns a tuple with the Transaction field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTransaction

`func (o *TransferShield200ResponseData) SetTransaction(v string)`

SetTransaction sets Transaction field to given value.

### HasTransaction

`func (o *TransferShield200ResponseData) HasTransaction() bool`

HasTransaction returns a boolean if a field has been set.

### GetStealthAddress

`func (o *TransferShield200ResponseData) GetStealthAddress() string`

GetStealthAddress returns the StealthAddress field if non-nil, zero value otherwise.

### GetStealthAddressOk

`func (o *TransferShield200ResponseData) GetStealthAddressOk() (*string, bool)`

GetStealthAddressOk returns a tuple with the StealthAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStealthAddress

`func (o *TransferShield200ResponseData) SetStealthAddress(v string)`

SetStealthAddress sets StealthAddress field to given value.

### HasStealthAddress

`func (o *TransferShield200ResponseData) HasStealthAddress() bool`

HasStealthAddress returns a boolean if a field has been set.

### GetEphemeralPublicKey

`func (o *TransferShield200ResponseData) GetEphemeralPublicKey() string`

GetEphemeralPublicKey returns the EphemeralPublicKey field if non-nil, zero value otherwise.

### GetEphemeralPublicKeyOk

`func (o *TransferShield200ResponseData) GetEphemeralPublicKeyOk() (*string, bool)`

GetEphemeralPublicKeyOk returns a tuple with the EphemeralPublicKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEphemeralPublicKey

`func (o *TransferShield200ResponseData) SetEphemeralPublicKey(v string)`

SetEphemeralPublicKey sets EphemeralPublicKey field to given value.

### HasEphemeralPublicKey

`func (o *TransferShield200ResponseData) HasEphemeralPublicKey() bool`

HasEphemeralPublicKey returns a boolean if a field has been set.

### GetViewTag

`func (o *TransferShield200ResponseData) GetViewTag() int32`

GetViewTag returns the ViewTag field if non-nil, zero value otherwise.

### GetViewTagOk

`func (o *TransferShield200ResponseData) GetViewTagOk() (*int32, bool)`

GetViewTagOk returns a tuple with the ViewTag field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewTag

`func (o *TransferShield200ResponseData) SetViewTag(v int32)`

SetViewTag sets ViewTag field to given value.

### HasViewTag

`func (o *TransferShield200ResponseData) HasViewTag() bool`

HasViewTag returns a boolean if a field has been set.

### GetCommitment

`func (o *TransferShield200ResponseData) GetCommitment() string`

GetCommitment returns the Commitment field if non-nil, zero value otherwise.

### GetCommitmentOk

`func (o *TransferShield200ResponseData) GetCommitmentOk() (*string, bool)`

GetCommitmentOk returns a tuple with the Commitment field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCommitment

`func (o *TransferShield200ResponseData) SetCommitment(v string)`

SetCommitment sets Commitment field to given value.

### HasCommitment

`func (o *TransferShield200ResponseData) HasCommitment() bool`

HasCommitment returns a boolean if a field has been set.

### GetBlindingFactor

`func (o *TransferShield200ResponseData) GetBlindingFactor() string`

GetBlindingFactor returns the BlindingFactor field if non-nil, zero value otherwise.

### GetBlindingFactorOk

`func (o *TransferShield200ResponseData) GetBlindingFactorOk() (*string, bool)`

GetBlindingFactorOk returns a tuple with the BlindingFactor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBlindingFactor

`func (o *TransferShield200ResponseData) SetBlindingFactor(v string)`

SetBlindingFactor sets BlindingFactor field to given value.

### HasBlindingFactor

`func (o *TransferShield200ResponseData) HasBlindingFactor() bool`

HasBlindingFactor returns a boolean if a field has been set.

### GetViewingKeyHash

`func (o *TransferShield200ResponseData) GetViewingKeyHash() string`

GetViewingKeyHash returns the ViewingKeyHash field if non-nil, zero value otherwise.

### GetViewingKeyHashOk

`func (o *TransferShield200ResponseData) GetViewingKeyHashOk() (*string, bool)`

GetViewingKeyHashOk returns a tuple with the ViewingKeyHash field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKeyHash

`func (o *TransferShield200ResponseData) SetViewingKeyHash(v string)`

SetViewingKeyHash sets ViewingKeyHash field to given value.

### HasViewingKeyHash

`func (o *TransferShield200ResponseData) HasViewingKeyHash() bool`

HasViewingKeyHash returns a boolean if a field has been set.

### GetSharedSecret

`func (o *TransferShield200ResponseData) GetSharedSecret() string`

GetSharedSecret returns the SharedSecret field if non-nil, zero value otherwise.

### GetSharedSecretOk

`func (o *TransferShield200ResponseData) GetSharedSecretOk() (*string, bool)`

GetSharedSecretOk returns a tuple with the SharedSecret field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSharedSecret

`func (o *TransferShield200ResponseData) SetSharedSecret(v string)`

SetSharedSecret sets SharedSecret field to given value.

### HasSharedSecret

`func (o *TransferShield200ResponseData) HasSharedSecret() bool`

HasSharedSecret returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


