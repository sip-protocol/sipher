# StealthCheckRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**StealthAddress** | [**StealthAddress**](StealthAddress.md) |  | 
**SpendingPrivateKey** | **string** | 0x-prefixed 32-byte hex string | 
**ViewingPrivateKey** | **string** | 0x-prefixed 32-byte hex string | 

## Methods

### NewStealthCheckRequest

`func NewStealthCheckRequest(stealthAddress StealthAddress, spendingPrivateKey string, viewingPrivateKey string, ) *StealthCheckRequest`

NewStealthCheckRequest instantiates a new StealthCheckRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewStealthCheckRequestWithDefaults

`func NewStealthCheckRequestWithDefaults() *StealthCheckRequest`

NewStealthCheckRequestWithDefaults instantiates a new StealthCheckRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetStealthAddress

`func (o *StealthCheckRequest) GetStealthAddress() StealthAddress`

GetStealthAddress returns the StealthAddress field if non-nil, zero value otherwise.

### GetStealthAddressOk

`func (o *StealthCheckRequest) GetStealthAddressOk() (*StealthAddress, bool)`

GetStealthAddressOk returns a tuple with the StealthAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStealthAddress

`func (o *StealthCheckRequest) SetStealthAddress(v StealthAddress)`

SetStealthAddress sets StealthAddress field to given value.


### GetSpendingPrivateKey

`func (o *StealthCheckRequest) GetSpendingPrivateKey() string`

GetSpendingPrivateKey returns the SpendingPrivateKey field if non-nil, zero value otherwise.

### GetSpendingPrivateKeyOk

`func (o *StealthCheckRequest) GetSpendingPrivateKeyOk() (*string, bool)`

GetSpendingPrivateKeyOk returns a tuple with the SpendingPrivateKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSpendingPrivateKey

`func (o *StealthCheckRequest) SetSpendingPrivateKey(v string)`

SetSpendingPrivateKey sets SpendingPrivateKey field to given value.


### GetViewingPrivateKey

`func (o *StealthCheckRequest) GetViewingPrivateKey() string`

GetViewingPrivateKey returns the ViewingPrivateKey field if non-nil, zero value otherwise.

### GetViewingPrivateKeyOk

`func (o *StealthCheckRequest) GetViewingPrivateKeyOk() (*string, bool)`

GetViewingPrivateKeyOk returns a tuple with the ViewingPrivateKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingPrivateKey

`func (o *StealthCheckRequest) SetViewingPrivateKey(v string)`

SetViewingPrivateKey sets ViewingPrivateKey field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


