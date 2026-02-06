# TransferClaimRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**StealthAddress** | **string** | Base58-encoded Solana public key | 
**EphemeralPublicKey** | **string** | Base58-encoded Solana public key | 
**SpendingPrivateKey** | **string** | 0x-prefixed 32-byte hex string | 
**ViewingPrivateKey** | **string** | 0x-prefixed 32-byte hex string | 
**DestinationAddress** | **string** | Base58-encoded Solana public key | 
**Mint** | **string** | Base58-encoded Solana public key | 

## Methods

### NewTransferClaimRequest

`func NewTransferClaimRequest(stealthAddress string, ephemeralPublicKey string, spendingPrivateKey string, viewingPrivateKey string, destinationAddress string, mint string, ) *TransferClaimRequest`

NewTransferClaimRequest instantiates a new TransferClaimRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewTransferClaimRequestWithDefaults

`func NewTransferClaimRequestWithDefaults() *TransferClaimRequest`

NewTransferClaimRequestWithDefaults instantiates a new TransferClaimRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetStealthAddress

`func (o *TransferClaimRequest) GetStealthAddress() string`

GetStealthAddress returns the StealthAddress field if non-nil, zero value otherwise.

### GetStealthAddressOk

`func (o *TransferClaimRequest) GetStealthAddressOk() (*string, bool)`

GetStealthAddressOk returns a tuple with the StealthAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStealthAddress

`func (o *TransferClaimRequest) SetStealthAddress(v string)`

SetStealthAddress sets StealthAddress field to given value.


### GetEphemeralPublicKey

`func (o *TransferClaimRequest) GetEphemeralPublicKey() string`

GetEphemeralPublicKey returns the EphemeralPublicKey field if non-nil, zero value otherwise.

### GetEphemeralPublicKeyOk

`func (o *TransferClaimRequest) GetEphemeralPublicKeyOk() (*string, bool)`

GetEphemeralPublicKeyOk returns a tuple with the EphemeralPublicKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEphemeralPublicKey

`func (o *TransferClaimRequest) SetEphemeralPublicKey(v string)`

SetEphemeralPublicKey sets EphemeralPublicKey field to given value.


### GetSpendingPrivateKey

`func (o *TransferClaimRequest) GetSpendingPrivateKey() string`

GetSpendingPrivateKey returns the SpendingPrivateKey field if non-nil, zero value otherwise.

### GetSpendingPrivateKeyOk

`func (o *TransferClaimRequest) GetSpendingPrivateKeyOk() (*string, bool)`

GetSpendingPrivateKeyOk returns a tuple with the SpendingPrivateKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSpendingPrivateKey

`func (o *TransferClaimRequest) SetSpendingPrivateKey(v string)`

SetSpendingPrivateKey sets SpendingPrivateKey field to given value.


### GetViewingPrivateKey

`func (o *TransferClaimRequest) GetViewingPrivateKey() string`

GetViewingPrivateKey returns the ViewingPrivateKey field if non-nil, zero value otherwise.

### GetViewingPrivateKeyOk

`func (o *TransferClaimRequest) GetViewingPrivateKeyOk() (*string, bool)`

GetViewingPrivateKeyOk returns a tuple with the ViewingPrivateKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingPrivateKey

`func (o *TransferClaimRequest) SetViewingPrivateKey(v string)`

SetViewingPrivateKey sets ViewingPrivateKey field to given value.


### GetDestinationAddress

`func (o *TransferClaimRequest) GetDestinationAddress() string`

GetDestinationAddress returns the DestinationAddress field if non-nil, zero value otherwise.

### GetDestinationAddressOk

`func (o *TransferClaimRequest) GetDestinationAddressOk() (*string, bool)`

GetDestinationAddressOk returns a tuple with the DestinationAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDestinationAddress

`func (o *TransferClaimRequest) SetDestinationAddress(v string)`

SetDestinationAddress sets DestinationAddress field to given value.


### GetMint

`func (o *TransferClaimRequest) GetMint() string`

GetMint returns the Mint field if non-nil, zero value otherwise.

### GetMintOk

`func (o *TransferClaimRequest) GetMintOk() (*string, bool)`

GetMintOk returns a tuple with the Mint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMint

`func (o *TransferClaimRequest) SetMint(v string)`

SetMint sets Mint field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


