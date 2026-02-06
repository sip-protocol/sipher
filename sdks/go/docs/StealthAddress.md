# StealthAddress

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Address** | **string** | 0x-prefixed 32-byte hex string | 
**EphemeralPublicKey** | **string** | 0x-prefixed 32-byte hex string | 
**ViewTag** | **int32** |  | 

## Methods

### NewStealthAddress

`func NewStealthAddress(address string, ephemeralPublicKey string, viewTag int32, ) *StealthAddress`

NewStealthAddress instantiates a new StealthAddress object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewStealthAddressWithDefaults

`func NewStealthAddressWithDefaults() *StealthAddress`

NewStealthAddressWithDefaults instantiates a new StealthAddress object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetAddress

`func (o *StealthAddress) GetAddress() string`

GetAddress returns the Address field if non-nil, zero value otherwise.

### GetAddressOk

`func (o *StealthAddress) GetAddressOk() (*string, bool)`

GetAddressOk returns a tuple with the Address field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAddress

`func (o *StealthAddress) SetAddress(v string)`

SetAddress sets Address field to given value.


### GetEphemeralPublicKey

`func (o *StealthAddress) GetEphemeralPublicKey() string`

GetEphemeralPublicKey returns the EphemeralPublicKey field if non-nil, zero value otherwise.

### GetEphemeralPublicKeyOk

`func (o *StealthAddress) GetEphemeralPublicKeyOk() (*string, bool)`

GetEphemeralPublicKeyOk returns a tuple with the EphemeralPublicKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEphemeralPublicKey

`func (o *StealthAddress) SetEphemeralPublicKey(v string)`

SetEphemeralPublicKey sets EphemeralPublicKey field to given value.


### GetViewTag

`func (o *StealthAddress) GetViewTag() int32`

GetViewTag returns the ViewTag field if non-nil, zero value otherwise.

### GetViewTagOk

`func (o *StealthAddress) GetViewTagOk() (*int32, bool)`

GetViewTagOk returns a tuple with the ViewTag field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewTag

`func (o *StealthAddress) SetViewTag(v int32)`

SetViewTag sets ViewTag field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


