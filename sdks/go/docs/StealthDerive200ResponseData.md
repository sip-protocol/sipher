# StealthDerive200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**StealthAddress** | Pointer to [**StealthAddress**](StealthAddress.md) |  | [optional] 
**SharedSecret** | Pointer to **string** | 0x-prefixed 32-byte hex string | [optional] 

## Methods

### NewStealthDerive200ResponseData

`func NewStealthDerive200ResponseData() *StealthDerive200ResponseData`

NewStealthDerive200ResponseData instantiates a new StealthDerive200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewStealthDerive200ResponseDataWithDefaults

`func NewStealthDerive200ResponseDataWithDefaults() *StealthDerive200ResponseData`

NewStealthDerive200ResponseDataWithDefaults instantiates a new StealthDerive200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetStealthAddress

`func (o *StealthDerive200ResponseData) GetStealthAddress() StealthAddress`

GetStealthAddress returns the StealthAddress field if non-nil, zero value otherwise.

### GetStealthAddressOk

`func (o *StealthDerive200ResponseData) GetStealthAddressOk() (*StealthAddress, bool)`

GetStealthAddressOk returns a tuple with the StealthAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStealthAddress

`func (o *StealthDerive200ResponseData) SetStealthAddress(v StealthAddress)`

SetStealthAddress sets StealthAddress field to given value.

### HasStealthAddress

`func (o *StealthDerive200ResponseData) HasStealthAddress() bool`

HasStealthAddress returns a boolean if a field has been set.

### GetSharedSecret

`func (o *StealthDerive200ResponseData) GetSharedSecret() string`

GetSharedSecret returns the SharedSecret field if non-nil, zero value otherwise.

### GetSharedSecretOk

`func (o *StealthDerive200ResponseData) GetSharedSecretOk() (*string, bool)`

GetSharedSecretOk returns a tuple with the SharedSecret field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSharedSecret

`func (o *StealthDerive200ResponseData) SetSharedSecret(v string)`

SetSharedSecret sets SharedSecret field to given value.

### HasSharedSecret

`func (o *StealthDerive200ResponseData) HasSharedSecret() bool`

HasSharedSecret returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


