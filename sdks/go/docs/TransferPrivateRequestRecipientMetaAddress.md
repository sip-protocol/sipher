# TransferPrivateRequestRecipientMetaAddress

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**SpendingKey** | **string** | 32-byte (ed25519) or 33-byte (secp256k1) hex key | 
**ViewingKey** | **string** | 32-byte (ed25519) or 33-byte (secp256k1) hex key | 
**Chain** | **string** |  | 
**Label** | Pointer to **string** |  | [optional] 

## Methods

### NewTransferPrivateRequestRecipientMetaAddress

`func NewTransferPrivateRequestRecipientMetaAddress(spendingKey string, viewingKey string, chain string, ) *TransferPrivateRequestRecipientMetaAddress`

NewTransferPrivateRequestRecipientMetaAddress instantiates a new TransferPrivateRequestRecipientMetaAddress object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewTransferPrivateRequestRecipientMetaAddressWithDefaults

`func NewTransferPrivateRequestRecipientMetaAddressWithDefaults() *TransferPrivateRequestRecipientMetaAddress`

NewTransferPrivateRequestRecipientMetaAddressWithDefaults instantiates a new TransferPrivateRequestRecipientMetaAddress object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSpendingKey

`func (o *TransferPrivateRequestRecipientMetaAddress) GetSpendingKey() string`

GetSpendingKey returns the SpendingKey field if non-nil, zero value otherwise.

### GetSpendingKeyOk

`func (o *TransferPrivateRequestRecipientMetaAddress) GetSpendingKeyOk() (*string, bool)`

GetSpendingKeyOk returns a tuple with the SpendingKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSpendingKey

`func (o *TransferPrivateRequestRecipientMetaAddress) SetSpendingKey(v string)`

SetSpendingKey sets SpendingKey field to given value.


### GetViewingKey

`func (o *TransferPrivateRequestRecipientMetaAddress) GetViewingKey() string`

GetViewingKey returns the ViewingKey field if non-nil, zero value otherwise.

### GetViewingKeyOk

`func (o *TransferPrivateRequestRecipientMetaAddress) GetViewingKeyOk() (*string, bool)`

GetViewingKeyOk returns a tuple with the ViewingKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKey

`func (o *TransferPrivateRequestRecipientMetaAddress) SetViewingKey(v string)`

SetViewingKey sets ViewingKey field to given value.


### GetChain

`func (o *TransferPrivateRequestRecipientMetaAddress) GetChain() string`

GetChain returns the Chain field if non-nil, zero value otherwise.

### GetChainOk

`func (o *TransferPrivateRequestRecipientMetaAddress) GetChainOk() (*string, bool)`

GetChainOk returns a tuple with the Chain field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChain

`func (o *TransferPrivateRequestRecipientMetaAddress) SetChain(v string)`

SetChain sets Chain field to given value.


### GetLabel

`func (o *TransferPrivateRequestRecipientMetaAddress) GetLabel() string`

GetLabel returns the Label field if non-nil, zero value otherwise.

### GetLabelOk

`func (o *TransferPrivateRequestRecipientMetaAddress) GetLabelOk() (*string, bool)`

GetLabelOk returns a tuple with the Label field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabel

`func (o *TransferPrivateRequestRecipientMetaAddress) SetLabel(v string)`

SetLabel sets Label field to given value.

### HasLabel

`func (o *TransferPrivateRequestRecipientMetaAddress) HasLabel() bool`

HasLabel returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


