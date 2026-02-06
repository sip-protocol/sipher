# StealthMetaAddress

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**SpendingKey** | **string** | 0x-prefixed 32-byte hex string | 
**ViewingKey** | **string** | 0x-prefixed 32-byte hex string | 
**Chain** | **string** |  | 
**Label** | Pointer to **string** |  | [optional] 

## Methods

### NewStealthMetaAddress

`func NewStealthMetaAddress(spendingKey string, viewingKey string, chain string, ) *StealthMetaAddress`

NewStealthMetaAddress instantiates a new StealthMetaAddress object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewStealthMetaAddressWithDefaults

`func NewStealthMetaAddressWithDefaults() *StealthMetaAddress`

NewStealthMetaAddressWithDefaults instantiates a new StealthMetaAddress object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSpendingKey

`func (o *StealthMetaAddress) GetSpendingKey() string`

GetSpendingKey returns the SpendingKey field if non-nil, zero value otherwise.

### GetSpendingKeyOk

`func (o *StealthMetaAddress) GetSpendingKeyOk() (*string, bool)`

GetSpendingKeyOk returns a tuple with the SpendingKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSpendingKey

`func (o *StealthMetaAddress) SetSpendingKey(v string)`

SetSpendingKey sets SpendingKey field to given value.


### GetViewingKey

`func (o *StealthMetaAddress) GetViewingKey() string`

GetViewingKey returns the ViewingKey field if non-nil, zero value otherwise.

### GetViewingKeyOk

`func (o *StealthMetaAddress) GetViewingKeyOk() (*string, bool)`

GetViewingKeyOk returns a tuple with the ViewingKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKey

`func (o *StealthMetaAddress) SetViewingKey(v string)`

SetViewingKey sets ViewingKey field to given value.


### GetChain

`func (o *StealthMetaAddress) GetChain() string`

GetChain returns the Chain field if non-nil, zero value otherwise.

### GetChainOk

`func (o *StealthMetaAddress) GetChainOk() (*string, bool)`

GetChainOk returns a tuple with the Chain field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChain

`func (o *StealthMetaAddress) SetChain(v string)`

SetChain sets Chain field to given value.


### GetLabel

`func (o *StealthMetaAddress) GetLabel() string`

GetLabel returns the Label field if non-nil, zero value otherwise.

### GetLabelOk

`func (o *StealthMetaAddress) GetLabelOk() (*string, bool)`

GetLabelOk returns a tuple with the Label field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabel

`func (o *StealthMetaAddress) SetLabel(v string)`

SetLabel sets Label field to given value.

### HasLabel

`func (o *StealthMetaAddress) HasLabel() bool`

HasLabel returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


