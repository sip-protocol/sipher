# StealthGenerate200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**MetaAddress** | Pointer to [**StealthMetaAddress**](StealthMetaAddress.md) |  | [optional] 
**SpendingPrivateKey** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 
**ViewingPrivateKey** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 

## Methods

### NewStealthGenerate200ResponseData

`func NewStealthGenerate200ResponseData() *StealthGenerate200ResponseData`

NewStealthGenerate200ResponseData instantiates a new StealthGenerate200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewStealthGenerate200ResponseDataWithDefaults

`func NewStealthGenerate200ResponseDataWithDefaults() *StealthGenerate200ResponseData`

NewStealthGenerate200ResponseDataWithDefaults instantiates a new StealthGenerate200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetMetaAddress

`func (o *StealthGenerate200ResponseData) GetMetaAddress() StealthMetaAddress`

GetMetaAddress returns the MetaAddress field if non-nil, zero value otherwise.

### GetMetaAddressOk

`func (o *StealthGenerate200ResponseData) GetMetaAddressOk() (*StealthMetaAddress, bool)`

GetMetaAddressOk returns a tuple with the MetaAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMetaAddress

`func (o *StealthGenerate200ResponseData) SetMetaAddress(v StealthMetaAddress)`

SetMetaAddress sets MetaAddress field to given value.

### HasMetaAddress

`func (o *StealthGenerate200ResponseData) HasMetaAddress() bool`

HasMetaAddress returns a boolean if a field has been set.

### GetSpendingPrivateKey

`func (o *StealthGenerate200ResponseData) GetSpendingPrivateKey() string`

GetSpendingPrivateKey returns the SpendingPrivateKey field if non-nil, zero value otherwise.

### GetSpendingPrivateKeyOk

`func (o *StealthGenerate200ResponseData) GetSpendingPrivateKeyOk() (*string, bool)`

GetSpendingPrivateKeyOk returns a tuple with the SpendingPrivateKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSpendingPrivateKey

`func (o *StealthGenerate200ResponseData) SetSpendingPrivateKey(v string)`

SetSpendingPrivateKey sets SpendingPrivateKey field to given value.

### HasSpendingPrivateKey

`func (o *StealthGenerate200ResponseData) HasSpendingPrivateKey() bool`

HasSpendingPrivateKey returns a boolean if a field has been set.

### GetViewingPrivateKey

`func (o *StealthGenerate200ResponseData) GetViewingPrivateKey() string`

GetViewingPrivateKey returns the ViewingPrivateKey field if non-nil, zero value otherwise.

### GetViewingPrivateKeyOk

`func (o *StealthGenerate200ResponseData) GetViewingPrivateKeyOk() (*string, bool)`

GetViewingPrivateKeyOk returns a tuple with the ViewingPrivateKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingPrivateKey

`func (o *StealthGenerate200ResponseData) SetViewingPrivateKey(v string)`

SetViewingPrivateKey sets ViewingPrivateKey field to given value.

### HasViewingPrivateKey

`func (o *StealthGenerate200ResponseData) HasViewingPrivateKey() bool`

HasViewingPrivateKey returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


