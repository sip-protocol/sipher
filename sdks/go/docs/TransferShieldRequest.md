# TransferShieldRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Sender** | **string** | Base58-encoded Solana public key | 
**RecipientMetaAddress** | [**StealthMetaAddress**](StealthMetaAddress.md) |  | 
**Amount** | **string** | Positive integer as string (no leading zeros) | 
**Mint** | Pointer to **string** | Optional SPL token mint. Omit for native SOL. | [optional] 

## Methods

### NewTransferShieldRequest

`func NewTransferShieldRequest(sender string, recipientMetaAddress StealthMetaAddress, amount string, ) *TransferShieldRequest`

NewTransferShieldRequest instantiates a new TransferShieldRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewTransferShieldRequestWithDefaults

`func NewTransferShieldRequestWithDefaults() *TransferShieldRequest`

NewTransferShieldRequestWithDefaults instantiates a new TransferShieldRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSender

`func (o *TransferShieldRequest) GetSender() string`

GetSender returns the Sender field if non-nil, zero value otherwise.

### GetSenderOk

`func (o *TransferShieldRequest) GetSenderOk() (*string, bool)`

GetSenderOk returns a tuple with the Sender field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSender

`func (o *TransferShieldRequest) SetSender(v string)`

SetSender sets Sender field to given value.


### GetRecipientMetaAddress

`func (o *TransferShieldRequest) GetRecipientMetaAddress() StealthMetaAddress`

GetRecipientMetaAddress returns the RecipientMetaAddress field if non-nil, zero value otherwise.

### GetRecipientMetaAddressOk

`func (o *TransferShieldRequest) GetRecipientMetaAddressOk() (*StealthMetaAddress, bool)`

GetRecipientMetaAddressOk returns a tuple with the RecipientMetaAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRecipientMetaAddress

`func (o *TransferShieldRequest) SetRecipientMetaAddress(v StealthMetaAddress)`

SetRecipientMetaAddress sets RecipientMetaAddress field to given value.


### GetAmount

`func (o *TransferShieldRequest) GetAmount() string`

GetAmount returns the Amount field if non-nil, zero value otherwise.

### GetAmountOk

`func (o *TransferShieldRequest) GetAmountOk() (*string, bool)`

GetAmountOk returns a tuple with the Amount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAmount

`func (o *TransferShieldRequest) SetAmount(v string)`

SetAmount sets Amount field to given value.


### GetMint

`func (o *TransferShieldRequest) GetMint() string`

GetMint returns the Mint field if non-nil, zero value otherwise.

### GetMintOk

`func (o *TransferShieldRequest) GetMintOk() (*string, bool)`

GetMintOk returns a tuple with the Mint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMint

`func (o *TransferShieldRequest) SetMint(v string)`

SetMint sets Mint field to given value.

### HasMint

`func (o *TransferShieldRequest) HasMint() bool`

HasMint returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


