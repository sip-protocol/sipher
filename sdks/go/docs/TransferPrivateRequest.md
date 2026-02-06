# TransferPrivateRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Sender** | **string** | Sender address (format varies by chain) | 
**RecipientMetaAddress** | [**TransferPrivateRequestRecipientMetaAddress**](TransferPrivateRequestRecipientMetaAddress.md) |  | 
**Amount** | **string** | Positive integer as string (no leading zeros) | 
**Token** | Pointer to **string** | Token contract/mint address. Omit for native currency. | [optional] 

## Methods

### NewTransferPrivateRequest

`func NewTransferPrivateRequest(sender string, recipientMetaAddress TransferPrivateRequestRecipientMetaAddress, amount string, ) *TransferPrivateRequest`

NewTransferPrivateRequest instantiates a new TransferPrivateRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewTransferPrivateRequestWithDefaults

`func NewTransferPrivateRequestWithDefaults() *TransferPrivateRequest`

NewTransferPrivateRequestWithDefaults instantiates a new TransferPrivateRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSender

`func (o *TransferPrivateRequest) GetSender() string`

GetSender returns the Sender field if non-nil, zero value otherwise.

### GetSenderOk

`func (o *TransferPrivateRequest) GetSenderOk() (*string, bool)`

GetSenderOk returns a tuple with the Sender field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSender

`func (o *TransferPrivateRequest) SetSender(v string)`

SetSender sets Sender field to given value.


### GetRecipientMetaAddress

`func (o *TransferPrivateRequest) GetRecipientMetaAddress() TransferPrivateRequestRecipientMetaAddress`

GetRecipientMetaAddress returns the RecipientMetaAddress field if non-nil, zero value otherwise.

### GetRecipientMetaAddressOk

`func (o *TransferPrivateRequest) GetRecipientMetaAddressOk() (*TransferPrivateRequestRecipientMetaAddress, bool)`

GetRecipientMetaAddressOk returns a tuple with the RecipientMetaAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRecipientMetaAddress

`func (o *TransferPrivateRequest) SetRecipientMetaAddress(v TransferPrivateRequestRecipientMetaAddress)`

SetRecipientMetaAddress sets RecipientMetaAddress field to given value.


### GetAmount

`func (o *TransferPrivateRequest) GetAmount() string`

GetAmount returns the Amount field if non-nil, zero value otherwise.

### GetAmountOk

`func (o *TransferPrivateRequest) GetAmountOk() (*string, bool)`

GetAmountOk returns a tuple with the Amount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAmount

`func (o *TransferPrivateRequest) SetAmount(v string)`

SetAmount sets Amount field to given value.


### GetToken

`func (o *TransferPrivateRequest) GetToken() string`

GetToken returns the Token field if non-nil, zero value otherwise.

### GetTokenOk

`func (o *TransferPrivateRequest) GetTokenOk() (*string, bool)`

GetTokenOk returns a tuple with the Token field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetToken

`func (o *TransferPrivateRequest) SetToken(v string)`

SetToken sets Token field to given value.

### HasToken

`func (o *TransferPrivateRequest) HasToken() bool`

HasToken returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


